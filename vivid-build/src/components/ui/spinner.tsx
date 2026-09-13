import { cn } from "@/lib/cn";

/** An indeterminate ring, for the moment a single row is waiting on the network. */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-3.5 animate-spin rounded-full border-[1.5px] border-line-3 border-t-fg-2",
        className,
      )}
    />
  );
}
