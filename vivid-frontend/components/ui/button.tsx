"use client";

import { cn } from "@/lib/utils";
import { ButtonSpinner } from "@/components/ui/button-spinner";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg" | "icon" | "icon-sm";

// Every variant is the same glass material at a different brightness. Hierarchy
// comes from how much light the surface carries, not from one variant being
// glass and another being flat.
const VARIANT: Record<Variant, string> = {
  // The primary action is bright glass: near-white, so it still refracts what
  // is behind it rather than reading as a painted rectangle.
  primary: "vd-glass-bright vd-sheen",
  secondary: "vd-glass-control vd-sheen text-white hover:border-white/28",
  outline: "vd-glass-control vd-sheen border-white/22 text-white hover:border-white/40",
  // Toolbar weight. Carries the material faintly so a row of icon buttons does
  // not read as a row of pills, and comes up to full glass on hover.
  ghost:
    "border border-transparent text-white/60 transition-colors hover:vd-glass-control hover:text-white",
  danger:
    "vd-glass-control vd-sheen border-destructive/45 bg-destructive/22 text-[#ffb4b4] hover:bg-destructive/32 hover:border-destructive/65",
};

const SIZE: Record<Size, string> = {
  sm: "h-8 gap-1.5 rounded-full px-3 text-[12.5px]",
  md: "h-10 gap-2 rounded-full px-4 text-[13.5px]",
  lg: "h-12 gap-2 rounded-full px-6 text-[15px]",
  icon: "size-10 rounded-full",
  "icon-sm": "size-8 rounded-full",
};

export interface ButtonProps extends React.ComponentProps<"button"> {
  variant?: Variant;
  size?: Size;
  // Shows the spinner and blocks interaction. The label stays in place so the
  // button does not change width mid-action.
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      data-slot="button"
      data-variant={variant}
      data-size={size}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center font-sans font-semibold whitespace-nowrap",
        "focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2",
        "disabled:pointer-events-none disabled:opacity-45",
        "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        VARIANT[variant],
        SIZE[size],
        fullWidth && "w-full",
        className
      )}
      {...props}
    >
      {loading ? <ButtonSpinner /> : null}
      {children}
    </button>
  );
}
