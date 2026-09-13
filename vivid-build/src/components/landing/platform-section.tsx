"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthButton } from "@/components/auth/auth-button";
import { InteractiveCard } from "@/components/ui/interactive-card";
import { Reveal } from "@/components/ui/reveal";
import { useStickyProgress } from "@/hooks/use-sticky-progress";
import { cn } from "@/lib/cn";
import { autoFitGrid, buttonClass } from "@/lib/ui";
import { PLATFORM_FEATURES } from "./data";
import { ProductShot } from "./product-shots";

/** Pinned section: scrolling steps through the platform features. */
export function PlatformSection() {
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const count = PLATFORM_FEATURES.length;

  const { trackRef, pinRef } = useStickyProgress((raw) => {
    const p = Math.min(0.999, raw) * count;
    const index = Math.floor(p);
    // Step the bar in 6% increments so scrolling doesn't re-render every frame.
    setActive(index);
    setProgress(Math.round(Math.round((p - index) * 100) / 6) * 6);
  });

  const feature = PLATFORM_FEATURES[active];

  return (
    <section className="border-t border-line bg-bg-2 px-gutter pt-[clamp(56px,7vw,90px)] pb-[clamp(48px,6vw,80px)]">
      <div ref={trackRef} className="relative h-[420vh]">
        <div
          ref={pinRef}
          className={cn(
            "sticky top-[88px] mx-auto grid max-w-[1220px] items-center gap-[clamp(28px,4vw,72px)]",
            autoFitGrid[300],
          )}
        >
          <div>
            <Reveal as="h2" className="text-[clamp(26px,3.6vw,46px)] leading-[1.06] font-extrabold tracking-[-0.035em]">
              For building and beyond
            </Reveal>
            <Reveal as="p" className="mt-3.5 max-w-[400px] text-[15px] leading-[1.55] text-pretty text-muted">
              Infrastructure built for production, so what you describe today keeps standing when it scales.
            </Reveal>

            <ul className="mt-[clamp(20px,2.6vw,40px)] flex flex-col border-b border-line-2">
              {PLATFORM_FEATURES.map((item, i) => {
                const isActive = i === active;
                return (
                  <li key={item.title} className="border-t border-line-2">
                    <button
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => {
                        setActive(i);
                        setProgress(0);
                      }}
                      className={cn(
                        "w-full cursor-pointer pt-[13px] pb-2.5 text-left text-base font-semibold tracking-[-0.02em] transition-colors duration-300",
                        isActive ? "text-fg" : "text-muted-2",
                      )}
                    >
                      {item.title}
                    </button>
                    {isActive && (
                      <p className="mb-3 max-w-[430px] text-sm leading-[1.55] text-pretty text-muted">{item.body}</p>
                    )}
                    <div className="h-0.5 overflow-hidden">
                      <div
                        className="h-0.5 bg-bar transition-[width] duration-120 ease-linear"
                        style={{ width: isActive ? `${progress}%` : "0%" }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="mt-5 flex flex-wrap gap-2.5">
              <AuthButton magnetic className={buttonClass({ size: "sm" })}>
                Start building free
              </AuthButton>
              <Link href="/pricing" className={buttonClass({ variant: "secondary", size: "sm" })}>
                See pricing
              </Link>
            </div>
          </div>

          <InteractiveCard
            tilt
            className="rounded-[26px] border border-line bg-[radial-gradient(120%_90%_at_50%_0%,var(--surface2),var(--bg)_70%)] p-[clamp(18px,2.4vw,40px)]"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-[10%] inset-y-[12%] rounded-[40px] bg-[radial-gradient(60%_60%_at_50%_60%,var(--glow-strong),transparent_70%)] blur-[30px]"
            />
            <div className="relative overflow-hidden rounded-2xl border border-line-3 bg-surface shadow-[0_40px_90px_-50px_rgba(0,0,0,0.95)]">
              <div className="flex items-center gap-2.5 border-b border-line bg-surface-2 px-3.5 py-[11px]">
                {[0, 1, 2].map((dot) => (
                  <span key={dot} aria-hidden className="block size-[9px] rounded-full bg-line-3" />
                ))}
                <span className="min-w-0 flex-1 truncate rounded-full border border-line-2 bg-surface px-3 py-[5px] text-center text-[11px] font-semibold text-muted-2">
                  {feature.url}
                </span>
              </div>
              <div className="relative h-[clamp(240px,30vw,400px)] bg-surface">
                {PLATFORM_FEATURES.map((item, i) => (
                  <ProductShot
                    key={item.title}
                    kind={item.shot}
                    ariaHidden={i !== active}
                    className={cn(
                      "pb-16 [transition:opacity_0.7s_ease,scale_1.2s_ease]",
                      i === active ? "scale-100 opacity-100" : "scale-106 opacity-0",
                    )}
                  />
                ))}
                <div className="absolute bottom-4 left-[18px] flex items-center gap-2 rounded-full border border-line-3 bg-chip px-3.5 py-2 backdrop-blur-[6px]">
                  <span aria-hidden className="block size-[7px] rounded-full bg-accent" />
                  <span className="text-xs font-semibold text-fg">{feature.label}</span>
                </div>
              </div>
            </div>
          </InteractiveCard>
        </div>
      </div>
    </section>
  );
}
