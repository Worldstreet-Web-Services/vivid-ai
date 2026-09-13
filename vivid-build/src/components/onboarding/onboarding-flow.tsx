"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogoMark } from "@/components/brand/logo";
import { useTheme } from "@/hooks/use-theme";
import { renameMe } from "@/lib/api/endpoints";
import { cn } from "@/lib/cn";
import { ONBOARDING_STEPS, STYLE_OPTIONS } from "./data";

/**
 * Two questions, because two answers have somewhere to go: the name via
 * PATCH /auth/me, and the theme to this device. The role, company-size and
 * email-preference steps were removed rather than left asking for things no
 * endpoint accepts.
 */
type Preferences = { name: string };

export function OnboardingFlow() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [stepIndex, setStepIndex] = useState(0);
  const [prefs, setPrefs] = useState<Preferences>({ name: "" });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const hasMovedRef = useRef(false);

  const step = ONBOARDING_STEPS[stepIndex];
  const isLast = stepIndex === ONBOARDING_STEPS.length - 1;

  // Move focus to the new question so screen reader users hear each step.
  useEffect(() => {
    if (hasMovedRef.current) headingRef.current?.focus();
  }, [stepIndex]);

  const goTo = (index: number) => {
    hasMovedRef.current = true;
    setStepIndex(index);
  };

  // A failed rename must never strand someone on the last step of onboarding —
  // the name is editable in settings, the app behind this is not.
  const finish = async () => {
    const name = prefs.name.trim();
    if (name) await renameMe(name).catch(() => undefined);
    router.push("/dashboard");
  };

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-5 pt-12 pb-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -bottom-[220px] h-[520px] bg-[radial-gradient(60%_60%_at_50%_100%,var(--glow-strong),transparent)]"
      />

      <div className="relative flex w-full max-w-[520px] flex-col items-center">
        <Link href="/" aria-label="VividBuild home">
          <LogoMark size="xl" />
        </Link>
        <p className="sr-only" aria-live="polite">
          Step {stepIndex + 1} of {ONBOARDING_STEPS.length}
        </p>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-[26px] text-center text-[clamp(26px,3.6vw,38px)] leading-[1.1] font-extrabold tracking-[-0.04em] text-balance outline-none"
        >
          {step.title}
        </h1>
        <p className="mt-2.5 max-w-[420px] text-center text-[15px] leading-[1.55] text-muted">{step.body}</p>

        {step.key === "you" && (
          <div className="mt-8 flex w-full max-w-[420px] flex-col gap-4 text-left">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted-2">Your name</span>
              <input
                autoFocus
                value={prefs.name}
                onChange={(event) => setPrefs((p) => ({ ...p, name: event.target.value }))}
                onKeyDown={(event) => event.key === "Enter" && goTo(stepIndex + 1)}
                placeholder="Ada Okonjo"
                className="rounded-xl border border-line-2 bg-surface px-3.5 py-3 text-[15px] text-fg outline-none transition-colors focus-visible:border-line-3"
              />
            </label>
          </div>
        )}

        {step.key === "style" && (
          <div className="mt-[34px] flex gap-4">
            {STYLE_OPTIONS.map((option) => {
              const selected = theme === option.theme;
              return (
                <button
                  key={option.theme}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setTheme(option.theme)}
                  className={cn(
                    "flex cursor-pointer flex-col items-center gap-2.5 rounded-2xl border-2 transition-colors",
                    selected ? "border-accent" : "border-line-2 hover:border-line-3",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn("flex h-[110px] w-[150px] max-w-[38vw] gap-2 overflow-hidden rounded-xl p-2.5", option.canvas)}
                  >
                    <span className="flex flex-1 flex-col gap-1.5">
                      <span className={cn("block size-3.5 rounded", option.mark)} />
                      <span className={cn("block h-2 rounded", option.bar)} />
                      <span className={cn("block h-2 rounded", option.bar)} />
                      <span className={cn("block h-2 w-3/5 rounded", option.bar)} />
                    </span>
                    <span className={cn("block w-[38px] rounded-lg", option.panel)} />
                  </span>
                  <span className={cn("pb-2.5 text-sm font-semibold", selected ? "text-fg" : "text-muted")}>
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        
        
        
        <button
          type="button"
          onClick={isLast ? () => void finish() : () => goTo(stepIndex + 1)}
          className="mt-[34px] w-full max-w-[460px] cursor-pointer rounded-full bg-btn px-6 py-[15px] text-base font-bold text-btn-fg shadow-sheen"
        >
          {isLast ? "Enter VividBuild" : "Next"}
        </button>
        <div className="mt-3 flex h-6 items-center gap-5 text-sm font-semibold">
          {stepIndex > 0 && (
            <button type="button" onClick={() => goTo(stepIndex - 1)} className="cursor-pointer text-muted hover:text-fg">
              Back
            </button>
          )}
          {!isLast && (
            <button type="button" onClick={() => void finish()} className="cursor-pointer text-muted-3 hover:text-fg">
              Skip for now
            </button>
          )}
        </div>
      </div>

      <div aria-hidden className="absolute inset-x-0 bottom-[34px] flex justify-center gap-[9px]">
        {ONBOARDING_STEPS.map((item, i) => (
          <span
            key={item.key}
            className={cn(
              "block h-[7px] rounded-full transition-[width,background-color] duration-300",
              i === stepIndex ? "w-[26px] bg-accent" : "w-[7px] bg-line-3",
            )}
          />
        ))}
      </div>
    </div>
  );
}
