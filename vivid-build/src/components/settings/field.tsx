"use client";

import { useId, type KeyboardEventHandler, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Shared input styling, so twenty hand-typed class strings can't drift apart. */
export const inputClass =
  "w-full rounded-xl border border-line-2 bg-surface-2 px-3.5 py-2.5 text-sm text-fg outline-none transition-colors focus-visible:border-line-3 disabled:cursor-not-allowed disabled:text-muted";

type FieldProps = {
  label: string;
  hint?: string;
  /** Receives the id to attach to the control. */
  children: (id: string) => ReactNode;
};

export function Field({ label, hint, children }: FieldProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-muted-2">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-xs text-muted-3">{hint}</p>}
    </div>
  );
}

export function FieldRow({
  children,
  className,
  onKeyDown,
}: {
  children: ReactNode;
  className?: string;
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
}) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2", className)} onKeyDown={onKeyDown}>
      {children}
    </div>
  );
}

/** Checkbox with its label, used across notification and interface settings. */
export function CheckboxField({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm leading-[1.5] text-fg-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4 flex-none accent-accent"
      />
      {children}
    </label>
  );
}
