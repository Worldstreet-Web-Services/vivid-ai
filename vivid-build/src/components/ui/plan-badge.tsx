import { cn } from "@/lib/cn";

export type PlanTier = "Pro" | "Business" | "Enterprise";

/**
 * Shown on features the current plan doesn't include. Locked things stay
 * visible rather than being hidden — seeing what exists is half the point.
 */
export function PlanBadge({ tier, className }: { tier: PlanTier; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex flex-none items-center rounded-md bg-tint px-1.5 py-0.5 text-[10px] font-bold tracking-[0.02em] text-fg-2",
        className,
      )}
    >
      {tier}
    </span>
  );
}
