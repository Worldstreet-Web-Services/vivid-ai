"use client";

import { useEffect, useRef } from "react";
import { InteractiveCard } from "@/components/ui/interactive-card";
import { Reveal } from "@/components/ui/reveal";
import { useStickyProgress } from "@/hooks/use-sticky-progress";
import { cn } from "@/lib/cn";
import { useBuildRun } from "./build-run-context";
import { BUILD_STAGES } from "./data";
import { ProductShot } from "./product-shots";

const STAGE_NAMES = ["Describe", "Plan", "Ship"] as const;

/** “How it builds”: scroll walks Describe → Plan → Ship, unless a simulated run is in progress. */
export function BuildLoopSection() {
  const { stage, running, log, progress, selectStage } = useBuildRun();
  const runningRef = useRef(running);
  const scrollStageRef = useRef<number | null>(null);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  const { trackRef, pinRef } = useStickyProgress((p) => {
    if (runningRef.current) return;
    const next = p >= 0.62 ? 2 : p >= 0.28 ? 1 : 0;
    // Only react when the scroll position crosses a threshold, so a click isn't overridden by a tiny scroll.
    if (next === scrollStageRef.current) return;
    scrollStageRef.current = next;
    selectStage(next);
  });

  const pick = (i: number) => {
    scrollStageRef.current = i;
    selectStage(i);
  };

  const current = BUILD_STAGES[stage];
  const lines = log.length ? log : current.log;
  // During a run the rail tracks the run; otherwise it rests on the selected stage.
  const railFill = running ? progress : (stage / (BUILD_STAGES.length - 1)) * 100;

  return (
    <section id="build" className="px-gutter pt-[clamp(48px,6vw,80px)] pb-[clamp(40px,5vw,64px)]">
      <div ref={trackRef} className="relative h-[260vh]">
        <div ref={pinRef} className="sticky top-[88px] mx-auto max-w-[1180px]">
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-3">
            <Reveal
              as="h2"
              className="max-w-[620px] text-[clamp(26px,3.4vw,44px)] leading-[1.06] font-extrabold tracking-[-0.035em] text-balance"
            >
              You bring the idea. VividBuild brings the build.
            </Reveal>
            <p className="max-w-[340px] text-[15px] leading-[1.55] text-pretty text-muted">
              Three stages, and you can read and change each one before anything ships.
            </p>
          </div>

          <div className="mt-[clamp(20px,3vw,36px)] grid items-stretch gap-[clamp(20px,3vw,48px)] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            {/* Every stage shares one grid cell, so switching never changes the pinned height. */}
            <div className="grid content-start lg:pt-5">
              {BUILD_STAGES.map((item, i) => {
                const active = i === stage;
                return (
                  <div
                    key={item.file}
                    inert={!active}
                    className={cn(
                      "[grid-area:1/1] transition-[opacity,translate] duration-500 ease-soft motion-reduce:transition-none",
                      active ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
                    )}
                  >
                    <p className="text-sm font-semibold text-muted-2">
                      Stage {i + 1} of {BUILD_STAGES.length}
                    </p>
                    <h3 className="mt-2 text-[clamp(22px,2.4vw,30px)] leading-[1.15] font-bold tracking-[-0.03em] text-balance text-fg">
                      {item.title}
                    </h3>
                    <p className="mt-3 max-w-[460px] text-[15px] leading-[1.6] text-pretty text-muted">{item.body}</p>
                    <ul className="mt-5 max-w-[460px] border-t border-line">
                      {item.points.map((point) => (
                        <li key={point} className="border-b border-line py-2.5 text-sm leading-[1.45] text-fg-2">
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            <InteractiveCard
              glow
              className="flex flex-col overflow-hidden rounded-[20px] border border-line-2 bg-surface shadow-[0_40px_80px_-60px_rgba(0,0,0,0.9)]"
            >
              <div className="flex items-center gap-3 border-b border-line bg-surface-2 px-4 py-2.5">
                <span aria-hidden className="flex gap-1.5">
                  {[0, 1, 2].map((dot) => (
                    <span key={dot} className="block size-2 rounded-full bg-line-3" />
                  ))}
                </span>
                <span className="min-w-0 flex-1 truncate text-center text-xs font-semibold text-muted-2">
                  {current.file}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-fg-2">
                  <span
                    aria-hidden
                    className={cn(
                      "block size-1.5 rounded-full",
                      running ? "bg-accent motion-safe:animate-pulse" : "bg-line-3",
                    )}
                  />
                  {running ? "Building" : "Ready"}
                </span>
              </div>

              <nav aria-label="Build stages" className="relative px-6 pt-4 pb-3">
                {/* Rail runs from the centre of the first stage column to the centre of the last. */}
                <div
                  role="progressbar"
                  aria-label="Build progress"
                  aria-valuenow={Math.round(railFill)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="absolute top-[26px] right-[calc(24px+(100%_-_48px)/6)] left-[calc(24px+(100%_-_48px)/6)] h-0.5 overflow-hidden rounded-full bg-line"
                >
                  <div
                    className="h-full bg-bar transition-[width] duration-500 ease-out motion-reduce:transition-none"
                    style={{ width: `${railFill}%` }}
                  />
                </div>
                <ol className="relative grid grid-cols-3">
                  {STAGE_NAMES.map((name, i) => {
                    const active = i === stage;
                    const reached = i < stage;
                    return (
                      <li key={name} className="flex justify-center">
                        <button
                          type="button"
                          onClick={() => pick(i)}
                          aria-current={active ? "step" : undefined}
                          className="group flex cursor-pointer flex-col items-center gap-2 rounded-lg px-2 outline-offset-4 focus-visible:outline-2 focus-visible:outline-accent"
                        >
                          <span
                            className={cn(
                              "flex size-[22px] items-center justify-center rounded-full border text-[11px] font-bold transition-colors duration-300",
                              active && "border-transparent bg-btn text-btn-fg",
                              reached && "border-accent bg-surface text-fg",
                              !active && !reached && "border-line-3 bg-surface text-muted-2 group-hover:border-accent",
                            )}
                          >
                            {i + 1}
                          </span>
                          <span
                            className={cn(
                              "text-xs font-semibold transition-colors",
                              active ? "text-fg" : "text-muted-2 group-hover:text-fg-2",
                            )}
                          >
                            {name}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </nav>

              <div className="relative h-[clamp(170px,24vh,230px)] overflow-hidden border-y border-line bg-bg">
                {BUILD_STAGES.map((item, i) => (
                  <ProductShot
                    key={item.file}
                    kind={item.shot}
                    ariaHidden={i !== stage}
                    className={cn(
                      "[transition:opacity_0.6s_ease,scale_1.4s_ease] motion-reduce:transition-none",
                      i === stage ? "scale-100 opacity-100" : "scale-108 opacity-0",
                    )}
                  />
                ))}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-[22%] bg-[linear-gradient(180deg,transparent,var(--surface))]"
                />
              </div>

              <div
                aria-live="polite"
                className="flex min-h-[96px] flex-1 flex-col gap-1.5 bg-surface px-5 py-4 font-mono text-xs text-muted-2"
              >
                {lines.map((line, i) => (
                  <span key={`${i}-${line}`} className={cn("block", i === lines.length - 1 && "text-fg-2")}>
                    {line}
                  </span>
                ))}
                <span aria-hidden className="inline-block h-[13px] w-[7px] animate-caret bg-accent" />
              </div>
            </InteractiveCard>
          </div>
        </div>
      </div>
    </section>
  );
}
