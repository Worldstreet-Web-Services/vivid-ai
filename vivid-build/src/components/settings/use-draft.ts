"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * A settings form draft with dirty tracking.
 *
 * Settings screens that always show an enabled Save button give no signal about
 * whether anything changed, and quietly lose edits when you navigate away. This
 * tracks both: `dirty` drives the button, and a beforeunload guard catches a
 * reload with unsaved work.
 */
export function useDraft<T extends Record<string, string>>(initial: T) {
  const [values, setValues] = useState(initial);

  const dirty = useMemo(
    () => (Object.keys(initial) as (keyof T)[]).some((key) => values[key] !== initial[key]),
    [values, initial],
  );

  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
  }, []);

  const reset = useCallback(() => setValues(initial), [initial]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  return { values, set, dirty, reset };
}
