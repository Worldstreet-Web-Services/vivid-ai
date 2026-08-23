import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  // Buttons aligned to the right of the title.
  actions?: React.ReactNode;
  className?: string;
}

// The title block every inner page uses, so headings keep one rhythm.
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex flex-col gap-1">
        <h1 className="ws-display text-[24px] leading-tight text-white">{title}</h1>
        {description ? (
          <p className="text-[13px] font-normal text-white/50">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
