import { cn } from "./cn";

type ButtonVariant = "primary" | "secondary";
type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2.5 rounded-full whitespace-nowrap cursor-pointer transition-transform duration-250 ease-soft";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-btn text-btn-fg font-bold shadow-sheen",
  secondary: "border border-line-2 text-fg font-semibold transition-colors hover:border-line-3",
};

const sizes: Record<ButtonSize, string> = {
  sm: "px-5 py-[11px] text-sm",
  md: "px-6 py-[13px] text-[15px]",
  lg: "px-7 py-[15px] text-base",
};

/** Shared pill button styles, usable on <button>, <a> and <Link>. */
export function buttonClass({
  variant = "primary",
  size = "md",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

/** Responsive grid that collapses to one column below `min`. */
export const autoFitGrid = {
  260: "grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))]",
  300: "grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))]",
} as const;
