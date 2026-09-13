"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/cn";

// Icon and label swap via the `light:` variant rather than React state,
// so server HTML already matches whatever theme the init script applied.
export function ThemeToggle({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle colour theme"
      title="Toggle colour theme"
      className={cn(
        "inline-flex cursor-pointer items-center gap-2 rounded-full border border-line-2 bg-surface text-[13px] font-semibold whitespace-nowrap text-fg-2",
        compact ? "size-9 justify-center" : "px-[13px] py-2",
        className,
      )}
    >
      <Moon aria-hidden className="size-4 flex-none light:hidden" />
      <Sun aria-hidden className="hidden size-4 flex-none light:block" />
      {!compact && (
        <>
          <span className="light:hidden">Light</span>
          <span className="hidden light:inline">Dark</span>
        </>
      )}
    </button>
  );
}
