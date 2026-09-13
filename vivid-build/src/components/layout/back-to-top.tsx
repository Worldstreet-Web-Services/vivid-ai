"use client";

import { ArrowUp } from "lucide-react";
import { useScrolledPast } from "@/hooks/use-scrolled-past";
import { cn } from "@/lib/cn";

export function BackToTop() {
  const visible = useScrolledPast(600);

  return (
    <button
      type="button"
      aria-label="Back to top"
      tabIndex={visible ? 0 : -1}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={cn(
        "fixed right-[clamp(16px,3vw,28px)] bottom-[clamp(16px,3vw,28px)] z-60 flex size-[46px] cursor-pointer items-center justify-center rounded-full border border-line-2 bg-surface text-fg shadow-[0_18px_40px_-24px_rgba(0,0,0,0.8)] transition-[opacity,translate] duration-300",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0",
      )}
    >
      <ArrowUp aria-hidden className="size-[18px]" />
    </button>
  );
}
