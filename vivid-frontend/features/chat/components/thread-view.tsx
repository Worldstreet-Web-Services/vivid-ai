"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AsyncError, AsyncLoading } from "@/components/ui/async-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Avatar } from "@/components/ui/avatar";
import { ChatComposer } from "@/features/chat/components/chat-composer";
import { AnswerActions } from "@/features/chat/components/answer-actions";
import { AddToSpaceDialog } from "@/features/chat/components/add-to-space-dialog";
import { ExportDialog } from "@/features/chat/components/export-dialog";
import { FeedbackDialog } from "@/features/chat/components/feedback-dialog";
import { RenameDialog } from "@/features/chat/components/rename-dialog";
import { ReportDialog } from "@/features/chat/components/report-dialog";
import { ShareDialog } from "@/features/chat/components/share-dialog";
import { SourceCard } from "@/features/chat/components/source-card";
import { SourceDialog } from "@/features/chat/components/source-dialog";
import { useSession } from "@/features/chat/hooks/use-session";
import type { Source } from "@/features/chat/lib/types";

interface ThreadViewProps {
  sessionId: string;
  // Spaces come from the route, so chat never imports the spaces slice.
  spaces: { id: string; name: string; count: number }[];
}

export function ThreadView({ sessionId, spaces }: ThreadViewProps) {
  const router = useRouter();
  const { data: session, isPending, isError, error, refetch } = useSession(sessionId);

  const [title, setTitle] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [ratings, setRatings] = useState<Record<string, "up" | "down">>({});
  const [openSource, setOpenSource] = useState<Source | null>(null);

  const [shareOpen, setShareOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [spaceOpen, setSpaceOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [feedbackFor, setFeedbackFor] = useState<"up" | "down" | null>(null);

  if (isPending) {
    return (
      <div className="mx-auto w-full max-w-[760px] px-5 py-10">
        <AsyncLoading label="Loading this thread" rows={4} />
      </div>
    );
  }

  if (isError || !session) {
    return (
      <div className="mx-auto w-full max-w-[760px] px-5 py-10">
        <AsyncError
          error={error}
          subject="this thread"
          unconfiguredDetail="Threads go live once the chat service is switched on."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const heading = title ?? session.title;

  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto w-full max-w-[760px] flex-1 px-5 pt-8 pb-6">
        <h1 className="ws-display text-[24px] leading-tight text-white">{heading}</h1>

        <div className="mt-8 flex flex-col gap-8">
          {session.messages.map((message) =>
            message.role === "user" ? (
              <div key={message.id} className="flex items-start gap-3">
                <Avatar name="Guest" size="sm" className="mt-0.5" />
                <p className="flex-1 pt-1 text-[15px] leading-relaxed font-medium text-white">
                  {message.content}
                </p>
              </div>
            ) : (
              <div key={message.id} className="flex flex-col gap-5">
                {message.sources?.length ? (
                  <section aria-label="Sources">
                    <h2 className="mb-2.5 text-[11.5px] font-semibold tracking-wide text-white/40 uppercase">
                      Sources
                    </h2>
                    <div className="grid gap-2.5 sm:grid-cols-3">
                      {message.sources.map((source, i) => (
                        <SourceCard
                          key={source.id}
                          source={source}
                          index={i}
                          onClick={() => setOpenSource(source)}
                        />
                      ))}
                    </div>
                  </section>
                ) : null}

                <div className="flex flex-col gap-4">
                  {message.content.split("\n\n").map((paragraph, i) => (
                    <p key={i} className="text-[15px] leading-[1.75] font-normal text-white/85">
                      {paragraph}
                    </p>
                  ))}
                </div>

                <AnswerActions
                  answer={message.content}
                  rating={ratings[message.id] ?? null}
                  onRate={(rating) => {
                    setRatings((prev) => ({ ...prev, [message.id]: rating }));
                    setFeedbackFor(rating);
                  }}
                  onShare={() => setShareOpen(true)}
                  onExport={() => setExportOpen(true)}
                  onRename={() => setRenameOpen(true)}
                  onAddToSpace={() => setSpaceOpen(true)}
                  onReport={() => setReportOpen(true)}
                  onDelete={() => setDeleteOpen(true)}
                />
              </div>
            )
          )}
        </div>
      </div>

      {/* The composer follows the thread rather than floating over it, so a
          long answer is never hidden behind it. */}
      <div className="sticky bottom-0 px-5 pb-6">
        <div className="mx-auto w-full max-w-[760px]">
          <ChatComposer value={prompt} onValueChange={setPrompt} onSubmit={setPrompt} />
        </div>
      </div>

      <SourceDialog source={openSource} onClose={() => setOpenSource(null)} />
      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} sessionId={session.id} />
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} sessionTitle={heading} />
      <RenameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        currentTitle={heading}
        onRename={setTitle}
      />
      <AddToSpaceDialog open={spaceOpen} onOpenChange={setSpaceOpen} spaces={spaces} />
      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} />
      <FeedbackDialog
        open={feedbackFor !== null}
        onOpenChange={(next) => {
          if (!next) setFeedbackFor(null);
        }}
        rating={feedbackFor}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        tone="danger"
        title="Delete this thread?"
        description="The thread and its answers are removed. This can't be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          setDeleteOpen(false);
          toast("Thread deleted");
          router.push("/");
        }}
      />
    </div>
  );
}
