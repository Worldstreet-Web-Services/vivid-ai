import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Bullet({
  children,
  className,
  dotClassName,
}: {
  children: ReactNode;
  className?: string;
  dotClassName?: string;
}) {
  return (
    <li className={cn("flex gap-3", className)}>
      <span aria-hidden className={cn("mt-[7px] block size-1.5 flex-none rounded-full bg-accent", dotClassName)} />
      <span>{children}</span>
    </li>
  );
}
