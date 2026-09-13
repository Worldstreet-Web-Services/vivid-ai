"use client";

import { ArrowUp, Hammer, Paperclip, PenLine, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import type { Asset } from "@/lib/api/types";
import { cn } from "@/lib/cn";

const MAX_HEIGHT = 168;

type Props = {
  onSend: (text: string, attachments: Asset[]) => void;
  /** Uploads one file and returns the stored asset. Rejects on failure. */
  onUpload: (file: File) => Promise<Asset>;
  /** The project's own stage. Shown, not chosen: the backend owns it. */
  mode: "plan" | "build";
  draft: string;
  onDraftChange: (draft: string) => void;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  /** A run is in flight, so sending another request is refused. */
  busy?: boolean;
};

export function ChatComposer({ onSend, onUpload, mode, draft, onDraftChange, inputRef, busy = false }: Props) {
  const fallbackRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = inputRef ?? fallbackRef;
  const fileRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [attachments, setAttachments] = useState<Asset[]>([]);
  const [uploading, setUploading] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Grow with the content up to a cap, then scroll — measured from a reset
  // height so deleting a line shrinks it back.
  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, MAX_HEIGHT)}px`;
  }, [draft, textareaRef]);

  const canSend = draft.trim().length > 0 && !busy && uploading === 0;

  const submit = () => {
    if (!canSend) return;
    onSend(draft, attachments);
    setAttachments([]);
  };

  /**
   * Uploads land in the project's asset store straight away rather than waiting
   * for send: the agent is told what a project holds, and an 8 MB image should
   * not be sitting in browser memory until someone finds the right words.
   */
  const upload = async (files: File[]) => {
    setUploadError(null);
    setUploading((count) => count + files.length);
    for (const file of files) {
      try {
        const asset = await onUpload(file);
        setAttachments((list) => [...list.filter((item) => item.id !== asset.id), asset]);
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : `Could not upload ${file.name}`);
      } finally {
        setUploading((count) => count - 1);
      }
    }
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="border-t border-line px-[18px] py-3.5"
    >
      <div className="flex flex-col gap-2 rounded-[14px] border border-line-2 bg-surface px-3 py-2.5 transition-colors focus-within:border-line-3">
        {(attachments.length > 0 || uploading > 0) && (
          <ul className="flex flex-wrap items-center gap-1.5">
            {attachments.map((asset) => (
              <li
                key={asset.id}
                className="flex items-center gap-1.5 rounded-md border border-line-2 bg-surface-2 py-1 pr-1 pl-2 text-[11px] font-semibold text-fg-2"
              >
                <span className="max-w-[160px] truncate">{asset.name}</span>
                <button
                  type="button"
                  onClick={() => setAttachments((list) => list.filter((item) => item.id !== asset.id))}
                  aria-label={`Remove ${asset.name}`}
                  className="cursor-pointer rounded text-muted-2 transition-colors hover:text-fg"
                >
                  <X aria-hidden className="size-3" />
                </button>
              </li>
            ))}
            {uploading > 0 && (
              <li className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
                <Spinner className="size-3" />
                Uploading {uploading} file{uploading === 1 ? "" : "s"}…
              </li>
            )}
          </ul>
        )}

        {uploadError && (
          <p role="alert" className="rounded-md bg-warn/20 px-2 py-1 text-[11px] font-semibold text-fg-2">
            {uploadError}
          </p>
        )}

        <label htmlFor={inputId} className="sr-only">
          Message VividBuild
        </label>
        <textarea
          id={inputId}
          ref={textareaRef}
          rows={1}
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends, Shift+Enter adds a line — same contract as the
            // dashboard composer.
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={
            busy ? "Working…" : mode === "plan" ? "Answer, or describe more of what you want…" : "Ask for a change…"
          }
          className="max-h-[168px] w-full resize-none bg-transparent px-0.5 text-sm leading-relaxed text-fg outline-none"
        />

        <div className="flex items-center gap-1.5">
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              // Lets the same file be picked again after it is removed.
              event.target.value = "";
              if (files.length) void upload(files);
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="Attach a file"
            className="flex cursor-pointer items-center rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <Paperclip aria-hidden className="size-4" />
          </button>

          {/* The stage is server state now — it flips when the spec is approved —
              so this reports it rather than offering a choice. */}
          <span className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-semibold text-fg-2">
            {mode === "plan" ? (
              <PenLine aria-hidden className="size-3.5 text-muted-2" />
            ) : (
              <Hammer aria-hidden className="size-3.5 text-muted-2" />
            )}
            {mode === "plan" ? "Planning" : "Building"}
          </span>

          <button
            type="submit"
            disabled={!canSend}
            aria-label="Send"
            className={cn(
              "ml-auto flex cursor-pointer items-center rounded-full bg-btn p-2 text-btn-fg transition-opacity",
              !canSend && "cursor-not-allowed opacity-40",
            )}
          >
            <ArrowUp aria-hidden className="size-4" />
          </button>
        </div>
      </div>
    </form>
  );
}

