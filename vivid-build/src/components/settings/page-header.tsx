import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

/** Title, blurb and a right-aligned Docs link — the header every settings page gets. */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 pb-1">
      <div className="min-w-0">
        <h1 className="text-xl font-extrabold tracking-[-0.03em]">{title}</h1>
        {description && <p className="mt-1 text-[13px] leading-[1.5] text-muted">{description}</p>}
      </div>
      <div className="flex flex-none items-center gap-2">
        {action}
        <a
          href="#"
          className="flex items-center gap-1.5 text-[13px] font-semibold text-muted transition-colors hover:text-fg"
        >
          Docs
          <ArrowUpRight aria-hidden className="size-3.5" />
        </a>
      </div>
    </header>
  );
}
