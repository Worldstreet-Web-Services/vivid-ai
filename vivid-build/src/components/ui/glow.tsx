import { cn } from "@/lib/cn";

/** Decorative radial light used behind hero headings and CTAs. */
export function Glow({ className, strong = false }: { className?: string; strong?: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute left-1/2 h-[520px] w-[900px] -translate-x-1/2",
        strong
          ? "bg-[radial-gradient(50%_50%_at_50%_50%,var(--glow-strong),transparent)]"
          : "bg-[radial-gradient(50%_50%_at_50%_50%,var(--glow),transparent)]",
        className,
      )}
    />
  );
}
