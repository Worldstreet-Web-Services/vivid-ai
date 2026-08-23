"use client";

import { cn } from "@/lib/utils";
import { ButtonSpinner } from "@/components/ui/button-spinner";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

// Variants are data attributes rather than a class-variance table, matching the
// sibling repo. Tailwind reads them through data-[variant=...] selectors, which
// keeps one class string per component and one place to look for it.
const VARIANT: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-white",
  secondary: "bg-white/10 text-white hover:bg-white/15",
  ghost: "text-white/70 hover:bg-white/8 hover:text-white",
  outline: "border border-white/15 text-white hover:border-white/35",
  danger: "bg-destructive text-white hover:bg-destructive/85",
};

const SIZE: Record<Size, string> = {
  sm: "h-8 gap-1.5 rounded-full px-3 text-[12.5px]",
  md: "h-10 gap-2 rounded-full px-4 text-[13.5px]",
  lg: "h-12 gap-2 rounded-full px-6 text-[15px]",
  icon: "size-10 rounded-full",
};

export interface ButtonProps extends React.ComponentProps<"button"> {
  variant?: Variant;
  size?: Size;
  // Shows the spinner and blocks interaction. Keep the label in place while
  // loading so the button does not change width mid-action.
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
        "inline-flex cursor-pointer items-center justify-center font-sans font-semibold whitespace-nowrap transition-colors",
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
