"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const SIZES = {
  sm: "max-w-[420px]",
  md: "max-w-[560px]",
  lg: "max-w-[720px]",
} as const;

type DialogProps = {
  title: string;
  description?: string;
  size?: keyof typeof SIZES;
  onClose: () => void;
  children: ReactNode;
  /** Rendered in the header row, right of the title. */
  headerAction?: ReactNode;
};

/**
 * Modal shell: overlay, Escape, scroll lock, focus move and restore.
 * Render it conditionally — mounting is what opens it.
 */
export function Dialog({ title, description, size = "md", onClose, children, headerAction }: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-200 flex items-start justify-center overflow-y-auto bg-[rgba(6,7,9,0.62)] p-4 backdrop-blur-[6px] sm:items-center sm:p-6">
      <div aria-hidden className="absolute inset-0" onClick={onClose} />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "relative my-auto flex max-h-[88vh] w-full flex-col overflow-hidden rounded-[20px] border border-line-2 bg-surface shadow-[0_50px_110px_-50px_rgba(0,0,0,0.85)] outline-none",
          SIZES[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-bold tracking-[-0.02em] text-fg">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-[13px] leading-[1.5] text-muted">
                {description}
              </p>
            )}
          </div>
          <div className="flex flex-none items-center gap-2">
            {headerAction}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex size-[30px] cursor-pointer items-center justify-center rounded-full border border-line-2 transition-colors hover:border-line-3"
            >
              <X aria-hidden className="size-3.5 text-muted" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
