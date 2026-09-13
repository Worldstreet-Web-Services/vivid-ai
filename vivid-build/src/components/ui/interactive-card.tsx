"use client";

import { useCallback, type ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";
import { bindGlow, bindTilt } from "@/lib/pointer-effects";

type InteractiveCardProps = ComponentPropsWithoutRef<"div"> & {
  /** 3D tilt towards the pointer. */
  tilt?: boolean;
  /** Soft radial highlight that follows the pointer. */
  glow?: boolean;
};

export function InteractiveCard({ tilt = false, glow = false, className, children, ...rest }: InteractiveCardProps) {
  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;
      const cleanups = [glow ? bindGlow(node) : undefined, tilt ? bindTilt(node) : undefined];
      return () => cleanups.forEach((cleanup) => cleanup?.());
    },
    [tilt, glow],
  );

  return (
    <div
      ref={ref}
      className={cn(
        "group/card relative",
        tilt && "transition-transform duration-350 ease-soft transform-3d",
        className,
      )}
      {...rest}
    >
      {children}
      {glow && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(340px_circle_at_var(--glow-x,50%)_var(--glow-y,50%),var(--tint),transparent_62%)] opacity-0 transition-opacity duration-350 group-hover/card:opacity-100"
        />
      )}
    </div>
  );
}
