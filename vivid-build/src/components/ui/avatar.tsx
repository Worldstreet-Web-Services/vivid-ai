import { cn } from "@/lib/cn";
import { hash32 } from "@/lib/seed";

const SIZES = {
  sm: "size-8 text-xs rounded-lg",
  md: "size-10 text-sm rounded-[10px]",
  lg: "size-12 text-lg rounded-xl",
} as const;

/**
 * Initial on a colour derived from the name, so members are distinguishable at
 * a glance instead of a wall of identical grey squares.
 */
export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const trimmed = name.trim() || "?";
  const hue = hash32(trimmed.toLowerCase()) % 360;

  return (
    <span
      aria-hidden
      className={cn("flex flex-none items-center justify-center font-extrabold", SIZES[size], className)}
      style={{
        // Mixed with the surface so it reads in both themes rather than
        // glowing in dark and washing out in light.
        backgroundColor: `color-mix(in srgb, hsl(${hue} 62% 52%) 22%, var(--surface))`,
        color: `hsl(${hue} 62% 46%)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, hsl(${hue} 62% 52%) 30%, transparent)`,
      }}
    >
      {trimmed.charAt(0).toUpperCase()}
    </span>
  );
}
