"use client";

import type { UIMessage } from "ai";
import { Spinner } from "@/components/ui/spinner";

/**
 * The one-line progress bar above the composer.
 *
 * §1 of the guide is explicit: show progress, not a spinner. A first build runs
 * 15-25 minutes, so a turn needs to say what it is doing right now — which is
 * why `data-status` is hoisted out of the transcript and shown here instead of
 * as another bubble scrolling away.
 */
export function TurnStatus({
  message,
  streaming,
  onStop,
}: {
  /** The assistant message currently being streamed. */
  message: UIMessage | null;
  streaming: boolean;
  onStop: () => void;
}) {
  if (!streaming) return null;

  const parts = message?.parts ?? [];

  let text = "Thinking…";
  let steps = 0;
  for (const part of parts) {
    if (part.type === "step-start") steps += 1;
    if (part.type === "data-status") {
      const status = (part as unknown as { data?: { text?: string } }).data;
      if (status?.text) text = status.text;
    }
    if (part.type === "data-review") {
      const review = (part as unknown as { data?: { round?: number } }).data;
      text = `Checking the app against the spec${review?.round ? ` (round ${review.round})` : ""}`;
    }
    if (part.type === "data-critique") text = "Looking at the page on desktop and phone";
  }

  return (
    <div className="flex items-center gap-2.5 border-t border-line bg-surface px-[18px] py-2.5">
      <Spinner />
      <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-fg-2">{text}</p>
      {steps > 0 && <span className="flex-none text-[11px] font-semibold text-muted-3">Step {steps}</span>}
      <button
        type="button"
        onClick={onStop}
        className="flex-none cursor-pointer rounded-full border border-line-2 px-3 py-1 text-[11px] font-bold text-muted transition-colors hover:text-fg"
      >
        Stop
      </button>
    </div>
  );
}
