"use client";

import { useRef, useState } from "react";

import {
  AttachIcon,
  ChevronDownIcon,
  MicIcon,
  SearchIcon,
  WaveformIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";

interface ChatComposerProps {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (value: string) => void;
  // Which model the request would run against. Static until the backend
  // exposes a model list.
  model?: string;
  className?: string;
}

// The prompt box. Grows with its content up to a cap, then scrolls.
export function ChatComposer({
  value,
  onValueChange,
  onSubmit,
  model = "Vivid 1.0",
  className,
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);

  function resize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }

  function submit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className={cn(
        "vd-glass-card vd-sheen w-full px-3.5 pt-3 pb-2.5 transition-colors",
        focused && "border-white/25",
        className
      )}
    >
      <label htmlFor="chat-prompt" className="sr-only">
        Ask anything
      </label>
      <textarea
        id="chat-prompt"
        ref={textareaRef}
        rows={1}
        value={value}
        placeholder="Ask anything…"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(event) => {
          onValueChange(event.target.value);
          resize(event.target);
        }}
        onKeyDown={(event) => {
          // Enter sends, Shift+Enter breaks the line.
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
        className="max-h-[220px] w-full resize-none bg-transparent font-sans text-[15px] font-normal text-white outline-none"
      />

      <div className="mt-2 flex items-center gap-1.5">
        <ComposerButton label="Attach a file">
          <AttachIcon size={18} />
        </ComposerButton>

        <ComposerButton label="Search the web" className="gap-1.5 px-2.5">
          <SearchIcon size={16} />
          <span className="text-[12.5px] font-semibold">Search</span>
          <ChevronDownIcon size={14} className="text-white/40" />
        </ComposerButton>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            className="hover:vd-glass-control flex h-8 cursor-pointer items-center gap-1 rounded-full px-2.5 text-[12.5px] font-medium text-white/55 transition-colors hover:text-white"
          >
            {model}
            <ChevronDownIcon size={14} className="text-white/40" />
          </button>

          <ComposerButton label="Dictate">
            <MicIcon size={18} />
          </ComposerButton>

          <button
            type="submit"
            aria-label="Send"
            disabled={!value.trim()}
            className="vd-glass-bright vd-sheen grid size-8 cursor-pointer place-items-center rounded-full disabled:pointer-events-none disabled:opacity-35"
          >
            <WaveformIcon size={16} />
          </button>
        </div>
      </div>
    </form>
  );
}

function ComposerButton({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "hover:vd-glass-control flex h-8 cursor-pointer items-center justify-center rounded-full px-2 text-white/55 transition-colors hover:text-white",
        className
      )}
    >
      {children}
    </button>
  );
}
