import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Props = {
  title: string;
  description?: string;
  /** Rendered in the footer bar, typically a Save button. */
  footer?: ReactNode;
  /** Footer helper text, left of the action. */
  note?: string;
  danger?: boolean;
  children: ReactNode;
};

/** The card every settings screen is built from: header, body, optional action bar. */
export function SettingsSection({ title, description, footer, note, danger = false, children }: Props) {
  return (
    <section className={cn("overflow-hidden rounded-2xl border bg-surface", danger ? "border-warn/40" : "border-line-2")}>
      <div className="border-b border-line px-4 py-3">
        <h2 className={cn("text-sm font-bold tracking-[-0.01em]", danger ? "text-warn" : "text-fg")}>{title}</h2>
        {description && <p className="mt-0.5 text-[13px] leading-[1.5] text-muted">{description}</p>}
      </div>

      <div className="px-4 py-4">{children}</div>

      {(footer || note) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-bg-2 px-4 py-2.5">
          <p className="text-xs text-muted">{note}</p>
          {footer}
        </div>
      )}
    </section>
  );
}
