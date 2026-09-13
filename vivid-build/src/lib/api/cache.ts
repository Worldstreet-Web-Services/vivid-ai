"use client";

/**
 * A tiny invalidation bus.
 *
 * The old store gave this for free: every screen subscribed to the same
 * localStorage key, so a rename in the top bar refreshed the sidebar. Server
 * state has no such shared source, so mutations announce themselves here and
 * the hooks watching a matching key refetch.
 */

const listeners = new Map<string, Set<() => void>>();

export function subscribeToKey(key: string, listener: () => void) {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(key);
  };
}

/** Refetches every key that starts with `prefix`, so `invalidate("projects")` catches `projects:abc`. */
export function invalidate(prefix: string) {
  listeners.forEach((set, key) => {
    if (key === prefix || key.startsWith(`${prefix}:`)) set.forEach((listener) => listener());
  });
}
