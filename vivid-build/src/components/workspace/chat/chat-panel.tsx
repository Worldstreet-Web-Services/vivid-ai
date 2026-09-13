"use client";

import type { UIMessage } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { inputClass } from "@/components/settings/field";
import { cancelTurn, key, listMessages, startBuild, updateProject, uploadAsset } from "@/lib/api/endpoints";
import { invalidate } from "@/lib/api/cache";
import { takeFirstMessage } from "@/lib/api/first-message";
import { toUIMessages } from "./use-project-chat";
import type { Asset, Project } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { buttonClass } from "@/lib/ui";
import { ChatComposer } from "../chat-composer";
import { ChatThread } from "./chat-thread";
import type { PartContext } from "./message-parts";
import { TurnStatus } from "./turn-status";
import { useProjectChat } from "./use-project-chat";

/**
 * A turn can take 25 minutes, so whoever started it is almost certainly looking
 * at something else by now: the toast covers another page in the app, the title
 * covers another tab entirely.
 *
 * The restore listener is the point. Without it the tab keeps saying "Done"
 * long after it has been read, and the next turn's "Done" says nothing new.
 */
function flagDoneInTitle(projectName: string) {
  if (!document.hidden) return;
  document.title = `✓ Done · ${projectName}`;
  const restore = () => {
    if (document.hidden) return;
    document.title = `${projectName} · VividBuild`;
    document.removeEventListener("visibilitychange", restore);
  };
  document.addEventListener("visibilitychange", restore);
}

/** In plan mode nothing was built, so saying "your app is ready" is a lie. */
function doneMessage(mode: Project["mode"]) {
  return mode === "build" ? "Your app is ready" : "Ready for you";
}

type Props = {
  className?: string;
  project: Project;
  initialMessages: UIMessage[];
  onSnapshot?: () => void;
  /** A turn raised from elsewhere — "Fix this" on a preview error. */
  request?: { text: string; at: number } | null;
};

/**
 * The left pane: the conversation with the builder.
 *
 * Mounted only once the stored thread has loaded — `useChat` reads `messages`
 * as an initial value and ignores later changes, so hydrating after mount would
 * silently show an empty thread.
 */
export function ChatPanel({ className, project, initialMessages, onSnapshot, request }: Props) {
  const { toast } = useToast();
  const [draft, setDraft] = useState("");
  const [specDraft, setSpecDraft] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { messages, sendMessage, setMessages, status, stop, error, clearError } = useProjectChat({
    projectId: project.id,
    initialMessages,
    onSnapshot,
    onDone: () => {
      toast(doneMessage(project.mode));
      flagDoneInTitle(project.name);
    },
  });

  const streaming = status === "submitted" || status === "streaming";

  const send = useCallback(
    (text: string, attachments: Asset[] = []) => {
      const request = text.trim();
      if (!request) return;
      clearError();

      // Reference screenshots only ride along in plan mode (§3 caps them at
      // four); in build mode the upload itself is how the agent sees a file.
      const images =
        project.mode === "plan"
          ? attachments.filter((asset) => asset.mime.startsWith("image/")).slice(0, 4)
          : [];

      void sendMessage({
        text: request,
        files: images.map((asset) => ({ type: "file" as const, mediaType: asset.mime, url: asset.url })),
      });
      // The composer is controlled from here, so emptying it is this function's
      // job — the send itself is fire-and-forget.
      setDraft("");
    },
    [sendMessage, clearError, project.mode],
  );

  // The dashboard creates the project, then hands the prompt over for the first
  // turn — creating and describing are two API calls now.
  //
  // The text is claimed from storage synchronously but sent on a timeout, so it
  // does not start a request during the mounting render. Holding it in a ref
  // matters: React double-invokes effects in development, and the first run's
  // cleanup cancels the timeout, so a guard that only remembered "I started"
  // would drop the message entirely.
  const pending = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (messages.length > 0) return;
    if (pending.current === undefined) pending.current = takeFirstMessage(project.id);
    const text = pending.current;
    if (!text) return;

    const id = window.setTimeout(() => {
      pending.current = null;
      send(text);
    }, 0);
    return () => window.clearTimeout(id);
  }, [project.id, messages.length, send]);

  // Raised by the preview pane. Keyed on the timestamp so the same error text
  // twice is two turns, not one.
  const lastRequest = useRef(0);
  useEffect(() => {
    if (!request || request.at === lastRequest.current) return;
    lastRequest.current = request.at;
    const id = window.setTimeout(() => send(request.text), 0);
    return () => window.clearTimeout(id);
  }, [request, send]);

  /**
   * A turn that is still running when you navigate away.
   *
   * The stream belongs to the page that started it, and the API exposes no
   * "is a turn running" flag — but §3 guarantees the assistant message is
   * stored before the stream ends. So a thread whose last message is the user's
   * is either mid-turn or just finished, and polling for the reply is the only
   * way to find out. Without this, coming back to a 20-minute build shows a
   * dead thread with no explanation.
   */
  const lastMessageId = messages.at(-1)?.id ?? null;
  // Keyed by message id, so giving up on one turn does not suppress the banner
  // for the next one.
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const waitingForReply =
    !streaming &&
    messages.length > 0 &&
    messages.at(-1)?.role === "user" &&
    dismissedFor !== lastMessageId;
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    if (!waitingForReply) {
      // Reset via a timeout rather than in the render path: this is a state
      // write and React 19 rejects one made synchronously in an effect body.
      const reset = window.setTimeout(() => setGaveUp(false), 0);
      return () => window.clearTimeout(reset);
    }

    let cancelled = false;
    const check = async () => {
      try {
        const fresh = await listMessages(project.id);
        if (cancelled || fresh.at(-1)?.role !== "assistant") return;
        setMessages(toUIMessages(fresh));

        // Say so. A turn can take 25 minutes, so whoever was waiting is almost
        // certainly looking at something else by now: the toast covers another
        // page in the app, and the title covers another tab entirely.
        toast(doneMessage(project.mode));
        flagDoneInTitle(project.name);
        // The build wrote files and may have published; nothing derived from
        // the old state is still true.
        invalidate(key.project(project.id));
        invalidate(key.files(project.id));
        invalidate(key.snapshots(project.id));
        onSnapshot?.();
      } catch {
        // Offline or a transient failure; the next tick tries again.
      }
    };

    const id = window.setInterval(check, 5000);
    // Longer than the 25 minutes §1 quotes for a first build. Past that the
    // turn is not coming back, and an endless spinner is worse than saying so.
    const deadline = window.setTimeout(() => setGaveUp(true), 30 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.clearTimeout(deadline);
    };
  }, [waitingForReply, project.id, project.name, project.mode, setMessages, toast, onSnapshot]);

  /**
   * Stop, and mean it.
   *
   * Two things happen here that used to be one. `stop()` aborts the local
   * stream — but after a reload there is no local stream, so on its own it does
   * nothing at all. `POST /cancel` stops the turn server-side, which matters
   * because aborting only the fetch would leave a 25-minute turn running and
   * still burning credits.
   *
   * Its `{cancelled}` answer was being thrown away, and that was the bug: when
   * a turn had already finished without persisting an assistant message, the
   * backend replied `cancelled: false` — "nothing was running" — and we ignored
   * it, so the "Still working on this" banner stayed up with no way to clear
   * it. That reply is the only signal the API gives that a turn is over, so it
   * now decides what the user is told.
   */
  const halt = async () => {
    stop();

    let running = true;
    try {
      const result = await cancelTurn(project.id);
      running = result.cancelled;
    } catch {
      // Could not ask. Treat it as finished rather than trapping the user.
      running = false;
    }

    // Either way this turn is done; let go of the banner.
    setDismissedFor(lastMessageId);

    if (!running) {
      toast("That turn had already finished");
      // It may well have written files and published before it ended without
      // leaving a message behind, so nothing derived from the old state holds.
      try {
        setMessages(toUIMessages(await listMessages(project.id)));
      } catch {
        // The refresh is a courtesy; the banner is gone regardless.
      }
      invalidate(key.project(project.id));
      invalidate(key.files(project.id));
      invalidate(key.snapshots(project.id));
      onSnapshot?.();
    }
  };

  /**
   * POST /build only flips the project from plan mode to build mode — it does
   * not start a turn. The button says "Build it", so it sends the first build
   * turn too rather than leaving the user to guess that they must now type.
   */
  const build = async () => {
    setBuilding(true);
    try {
      await startBuild(project.id);
      toast("Building — the first run takes 15 to 25 minutes");
      send("Build it.");
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : "Could not start the build", "warn");
    } finally {
      setBuilding(false);
    }
  };

  const saveSpec = async (markdown: string) => {
    setSpecDraft(null);
    try {
      await updateProject(project.id, { spec_md: markdown });
      toast("Spec updated");
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : "Could not save the spec", "warn");
    }
  };

  const context: PartContext = {
    streaming,
    answered: false,
    onSend: send,
    onEditSpec: setSpecDraft,
    onBuild: () => void build(),
    planning: project.mode === "plan" && !building,
  };

  const last = messages.at(-1) ?? null;

  return (
    <section aria-label="Chat" className={cn("min-w-0 flex-1 flex-col border-line lg:border-r", className)}>
      <div className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-[18px] py-5">
        {messages.length === 0 ? (
          <p className="m-auto max-w-[320px] text-center text-sm text-muted">
            Describe what you want to build. The agent will ask a few questions, write a spec, and then build it.
          </p>
        ) : (
          <ChatThread messages={messages} context={context} />
        )}

        {error && (
          <div className="mt-4 rounded-lg bg-warn/20 px-3 py-2.5">
            <p className="text-[13px] leading-[1.5] text-fg-2">{error.message}</p>
            <p className="mt-1 text-[11px] text-muted">
              The turn&apos;s output is saved before the stream ends, so reloading may show it anyway.
            </p>
          </div>
        )}
      </div>

      {waitingForReply && (
        <div className="flex items-center gap-2.5 border-t border-line bg-surface px-[18px] py-2.5">
          {!gaveUp && <Spinner />}
          <p className="min-w-0 flex-1 text-[13px] font-semibold text-fg-2">
            {gaveUp
              ? "No reply came back. The turn may have stopped — ask again to pick it up."
              : "Still working on this — it keeps going even if you leave."}
          </p>
          {/* Always offered. Once this banner is up, it is the only way out of
              it — and a turn that ended without leaving a message would
              otherwise keep it on screen indefinitely. */}
          <button
            type="button"
            onClick={() => void halt()}
            className="flex-none cursor-pointer rounded-full border border-line-2 px-3 py-1 text-[11px] font-bold text-muted transition-colors hover:text-fg"
          >
            {gaveUp ? "Dismiss" : "Stop"}
          </button>
        </div>
      )}

      <TurnStatus message={last?.role === "assistant" ? last : null} streaming={streaming} onStop={() => void halt()} />

      <ChatComposer
        draft={draft}
        onDraftChange={setDraft}
        onSend={send}
        onUpload={(file) => uploadAsset(project.id, file)}
        inputRef={inputRef}
        busy={streaming}
        mode={project.mode}
      />

      {specDraft !== null && (
        <Dialog title="Edit the spec" size="lg" onClose={() => setSpecDraft(null)}>
          <div className="flex flex-col gap-4 px-5 py-4">
            <textarea
              autoFocus
              rows={18}
              value={specDraft}
              onChange={(event) => setSpecDraft(event.target.value)}
              className={cn(inputClass, "resize-y font-mono text-[12.5px] leading-[1.6]")}
            />
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSpecDraft(null)}
                className={buttonClass({ variant: "secondary", size: "sm" })}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveSpec(specDraft)}
                className={buttonClass({ size: "sm" })}
              >
                Save spec
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </section>
  );
}
