"use client";

import { ChevronRight } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A collapsible section.
 *
 * Deliberately a button plus state rather than `<details>`: a closed `<details>`
 * hides every non-`<summary>` child regardless of CSS, which has already cost
 * this codebase a disappearing settings nav once.
 */
export function Disclosure({
  summary,
  defaultOpen = false,
  children,
  className,
}: {
  summary: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();

  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full cursor-pointer items-center gap-1.5 rounded-lg py-0.5 text-left text-[12px] font-medium text-muted transition-colors hover:text-fg"
      >
        <ChevronRight aria-hidden className={cn("size-3 flex-none transition-transform", open && "rotate-90")} />
        <span className="min-w-0 flex-1">{summary}</span>
      </button>
      {open && <div id={id}>{children}</div>}
    </div>
  );
}
