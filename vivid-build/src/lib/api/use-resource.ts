"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { subscribeToKey } from "./cache";
import { ApiError, type Async } from "./types";

type Options = {
  /** Skip the request entirely — for a resource that needs a prerequisite. */
  enabled?: boolean;
  /** Poll while mounted and visible. Off by default. */
  refreshMs?: number;
};

/**
 * Fetches one resource into the `Async<T>` shape every screen reads.
 *
 * Deliberately hand-rolled rather than swr, even though @ai-sdk/react pulls swr
 * in transitively — building on a transitive dependency is how it disappears
 * from under you.
 */
export function useResource<T>(
  key: string | null,
  fetcher: (signal: AbortSignal) => Promise<T>,
  { enabled = true, refreshMs }: Options = {},
): Async<T> & { refresh: () => void } {
  const [state, setState] = useState<Async<T>>({ status: "loading" });
  const [nonce, setNonce] = useState(0);

  // Held in a ref so changing the fetcher identity on every render — which is
  // the normal case for an inline arrow — does not restart the request. Synced
  // in an effect declared *before* the fetching one, so it is already current
  // by the time that runs.
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  const active = enabled && key !== null;

  useEffect(() => {
    if (!active) return;

    const controller = new AbortController();
    let cancelled = false;

    fetcherRef
      .current(controller.signal)
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch((error: unknown) => {
        if (cancelled || controller.signal.aborted) return;
        const apiError =
          error instanceof ApiError ? error : new ApiError(0, "unknown", (error as Error)?.message ?? "Request failed.");
        setState({ status: "error", error: apiError, retry: refresh });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [key, nonce, active, refresh]);

  // A mutation elsewhere announces itself on the bus; this is what keeps the
  // sidebar and the list in step after a rename or a delete.
  useEffect(() => {
    if (!key || !active) return;
    return subscribeToKey(key, refresh);
  }, [key, active, refresh]);

  useEffect(() => {
    if (!refreshMs || !active) return;
    const id = window.setInterval(() => {
      if (!document.hidden) refresh();
    }, refreshMs);
    return () => window.clearInterval(id);
  }, [refreshMs, active, refresh]);

  return { ...state, refresh };
}
