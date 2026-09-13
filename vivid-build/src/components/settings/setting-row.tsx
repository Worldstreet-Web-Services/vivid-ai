import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type SettingRowProps = {
  label: ReactNode;
  description?: ReactNode;
  /** Right-aligned control: a value, toggle, button or menu. */
  action?: ReactNode;
  className?: string;
};

/**
 * Label and description left, control right, hairline between rows.
 *
 * This is the dominant settings pattern in products like Lovable, and it reads
 * very differently from a stack of form fields — closer to a product surface
 * than a form. Wrap a group of these in `SettingRows`.
 */
export function SettingRow({ label, description, action, className }: SettingRowProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3.5 first:pt-0 last:pb-0",
        className,
      )}
    >
      <div className="min-w-0 flex-1 basis-[min(100%,260px)]">
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-fg">{label}</div>
        {description && <p className="mt-0.5 text-[13px] leading-[1.5] text-muted">{description}</p>}
      </div>
      {action && <div className="flex flex-none items-center gap-2">{action}</div>}
    </div>
  );
}

/** Groups rows with dividers. Drop inside a `SettingsSection`. */
export function SettingRows({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("divide-y divide-line", className)}>{children}</div>;
}

/** Plain right-aligned value, for read-only rows. */
export function RowValue({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("text-sm text-muted", className)}>{children}</span>;
}
