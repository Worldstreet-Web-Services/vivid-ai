import { cn } from "@/lib/utils";
import type { Source } from "@/features/chat/lib/types";

// The domain's first letter stands in for a favicon. Fetching real ones means
// a request per source to a third party, which is not worth it here.
function DomainMark({ domain }: { domain: string }) {
  return (
    <span
      aria-hidden="true"
      className="vd-glass-control grid size-5 shrink-0 place-items-center rounded-md text-[10px] font-semibold text-white/70"
    >
      {domain[0]?.toUpperCase()}
    </span>
  );
}

interface SourceCardProps {
  source: Source;
  // Position in the citation list, shown as a numbered pill.
  index: number;
  onClick?: () => void;
  className?: string;
}

export function SourceCard({ source, index, onClick, className }: SourceCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "vd-glass-card vd-sheen vd-glass-hover flex w-full cursor-pointer flex-col gap-2 rounded-[16px] p-3 text-left",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <DomainMark domain={source.domain} />
        <span className="truncate text-[11.5px] font-medium text-white/50">{source.domain}</span>
        <span className="ml-auto shrink-0 rounded-full bg-white/10 px-1.5 text-[10.5px] font-semibold text-white/60">
          {index + 1}
        </span>
      </div>
      <span className="line-clamp-2 text-[12.5px] leading-snug font-medium text-white/85">
        {source.title}
      </span>
    </button>
  );
}

// The inline citation marker that sits after a sentence in an answer.
export function CitationPill({ index, onClick }: { index: number; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Source ${index + 1}`}
      className="vd-glass-control mx-0.5 inline-grid size-[17px] cursor-pointer place-items-center rounded-full align-[1px] text-[10px] font-semibold text-white/70 hover:text-white"
    >
      {index + 1}
    </button>
  );
}
