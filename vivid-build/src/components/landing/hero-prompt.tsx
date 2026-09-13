"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { useAuthModal } from "@/components/auth/auth-modal-provider";
import { InteractiveCard } from "@/components/ui/interactive-card";
import { setPendingPrompt } from "@/lib/pending-prompt";
import { bindMagnet, prefersReducedMotion } from "@/lib/pointer-effects";
import { buttonClass } from "@/lib/ui";
import { useBuildRun } from "./build-run-context";
import { PROMPT_CHIPS, PROMPT_EXAMPLES } from "./data";

const DEFAULT_PLACEHOLDER = "Describe the app you want to build…";

/**
 * Types example prompts over the empty field. Visual only: the textarea keeps a static placeholder
 * (made transparent) so screen readers aren't re-announced a changing hint every few milliseconds.
 */
function TypewriterHint() {
  const [text, setText] = useState(DEFAULT_PLACEHOLDER);

  useEffect(() => {
    if (prefersReducedMotion()) return;

    let line = 0;
    let chars = 0;
    let direction = 1;
    let pausedUntil = 0;

    const id = window.setInterval(() => {
      if (Date.now() < pausedUntil) return;

      const full = PROMPT_EXAMPLES[line % PROMPT_EXAMPLES.length];
      chars += direction;
      setText(full.slice(0, chars) + (chars < full.length ? "|" : ""));

      if (chars >= full.length) {
        direction = -1;
        pausedUntil = Date.now() + 1400;
      } else if (chars <= 0) {
        direction = 1;
        line += 1;
      }
    }, 45);

    return () => window.clearInterval(id);
  }, []);

  return (
    <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 text-lg leading-normal text-muted-3">
      {text}
    </span>
  );
}

export function HeroPrompt() {
  const [prompt, setPrompt] = useState("");
  const { startRun } = useBuildRun();
  const { openAuth } = useAuthModal();
  const promptId = useId();

  // Signing in is the only way to actually build, so the prompt is parked for
  // the dashboard composer to pick up on the other side of the modal.
  const handOff = () => {
    setPendingPrompt(prompt);
    openAuth("signup");
  };
  const magnetRef = useCallback((node: HTMLButtonElement | null) => (node ? bindMagnet(node) : undefined), []);

  return (
    <InteractiveCard
      tilt
      glow
      className="mx-auto mt-[38px] max-w-[760px] overflow-hidden rounded-[20px] border border-line-2 bg-card text-left shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]"
    >
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-3 text-[11px] font-semibold tracking-[0.08em] text-muted-2">
        <span aria-hidden className="block size-2 rounded-full bg-accent" />
        NEW PROJECT
      </div>

      <div className="px-5 pt-5 pb-4">
        <label htmlFor={promptId} className="sr-only">
          Describe the app you want to build
        </label>
        <div className="relative">
          {prompt.length === 0 && <TypewriterHint />}
          <textarea
            id={promptId}
            rows={3}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              // Enter submits, Shift+Enter adds a line — the same contract as
              // the dashboard and workspace composers.
              if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
              event.preventDefault();
              if (prompt.trim()) handOff();
            }}
            placeholder={DEFAULT_PLACEHOLDER}
            className="relative w-full resize-none bg-transparent text-lg leading-normal text-fg outline-none placeholder:text-transparent"
          />
        </div>
        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          {PROMPT_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => setPrompt(chip)}
              className="cursor-pointer rounded-full border border-line-2 bg-surface-2 px-3 py-[7px] text-[13px] font-medium text-fg-2 transition-colors hover:border-accent hover:text-fg"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      <div className="relative z-1 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface px-5 py-3.5">
        <span className="text-[11px] font-semibold text-muted-2">
          {prompt.trim() ? "Press Enter to start" : "Start typing"} · spec drafted in ~20s
        </span>
        <button
          ref={magnetRef}
          type="button"
          // With a prompt typed, this does what Enter does. Empty, it runs the
          // page's own build demo, which is what the button is there to show.
          onClick={() => (prompt.trim() ? handOff() : startRun())}
          className={buttonClass({ className: "px-[22px] py-3 hover:bg-accent hover:bg-none" })}
        >
          Build it →
        </button>
      </div>
    </InteractiveCard>
  );
}
