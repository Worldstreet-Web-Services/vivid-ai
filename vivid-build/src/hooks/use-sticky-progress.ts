"use client";

import { useEffect, useRef } from "react";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Scroll-scrubbed section: a tall track with a sticky pin inside it.
 * Reports 0 → 1 progress as the track scrolls past the pinned content.
 *
 * When the pin is taller than the viewport (small screens) pinning is
 * switched off and the track collapses to its content, so there is no
 * dead scroll space; progress is not reported in that mode.
 */
export function useStickyProgress(onProgress: (progress: number) => void) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onProgress);

  useEffect(() => {
    callbackRef.current = onProgress;
  });

  useEffect(() => {
    const track = trackRef.current;
    const pin = pinRef.current;
    if (!track || !pin) return;

    let frame = 0;
    let mode: number | "off" | null = null;

    const measure = () => {
      frame = 0;
      const pinHeight = pin.offsetHeight;
      const viewport = window.innerHeight;

      if (pinHeight + 24 > viewport) {
        if (mode !== "off") {
          mode = "off";
          pin.style.position = "static";
          track.style.height = "auto";
        }
        return;
      }

      const top = Math.max(8, Math.min(88, viewport - pinHeight - 16));
      if (mode !== top) {
        mode = top;
        pin.style.position = "sticky";
        pin.style.top = `${top}px`;
        track.style.height = "";
      }
      const span = Math.max(1, track.offsetHeight - pinHeight - top);
      callbackRef.current(clamp01((top - track.getBoundingClientRect().top) / span));
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    // Measure synchronously on mount so small screens collapse the track before first paint.
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(pin);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      resizeObserver.disconnect();
    };
  }, []);

  return { trackRef, pinRef };
}
