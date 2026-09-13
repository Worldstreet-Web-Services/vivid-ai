"use client";

import { cn } from "@/lib/cn";

type ToggleProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
};

/** A real switch: role="switch" + aria-checked, keyboard operable like a button. */
export function Toggle({ checked, onChange, label, disabled = false, className }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 flex-none cursor-pointer items-center rounded-full border transition-colors duration-200",
        checked ? "border-transparent bg-accent" : "border-line-3 bg-surface-2",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "block size-4 rounded-full transition-transform duration-200 ease-soft",
          checked ? "translate-x-[22px] bg-bg" : "translate-x-[3px] bg-muted-2",
        )}
      />
    </button>
  );
}
