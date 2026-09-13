"use client";

import { useCallback, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type RevealProps = {
  as?: "div" | "h2" | "h3" | "p";
  className?: string;
  children: ReactNode;
};

/** Fades and lifts its content in the first time it scrolls into view. */
export function Reveal({ as: Tag = "div", className, children }: RevealProps) {
  const [visible, setVisible] = useState(false);

  const ref = useCallback((node: HTMLElement | null) => {
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setVisible(true);
        observer.disconnect();
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={cn(
        "transition-[opacity,translate] duration-700 ease-soft",
        visible ? "translate-y-0 opacity-100" : "translate-y-[18px] opacity-0",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
