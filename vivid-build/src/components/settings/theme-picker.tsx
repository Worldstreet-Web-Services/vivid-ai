"use client";

import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/cn";
import { STYLE_OPTIONS } from "@/components/onboarding/data";

/**
 * The two big style cards. Shared by onboarding and settings so the choice
 * looks identical in both places.
 */
export function ThemePicker({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div className={cn("flex flex-wrap gap-4", className)}>
      {STYLE_OPTIONS.map((option) => {
        const selected = theme === option.theme;
        return (
          <button
            key={option.theme}
            type="button"
            aria-pressed={selected}
            onClick={() => setTheme(option.theme)}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-2.5 rounded-2xl border-2 transition-colors",
              selected ? "border-accent" : "border-line-2 hover:border-line-3",
            )}
          >
            <span
              aria-hidden
              className={cn("flex h-[110px] w-[150px] max-w-[38vw] gap-2 overflow-hidden rounded-xl p-2.5", option.canvas)}
            >
              <span className="flex flex-1 flex-col gap-1.5">
                <span className={cn("block size-3.5 rounded", option.mark)} />
                <span className={cn("block h-2 rounded", option.bar)} />
                <span className={cn("block h-2 rounded", option.bar)} />
                <span className={cn("block h-2 w-3/5 rounded", option.bar)} />
              </span>
              <span className={cn("block w-[38px] rounded-lg", option.panel)} />
            </span>
            <span className={cn("pb-2.5 text-sm font-semibold", selected ? "text-fg" : "text-muted")}>
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
