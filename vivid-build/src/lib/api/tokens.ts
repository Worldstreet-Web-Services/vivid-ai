"use client";

import type { Tokens } from "./types";

/**
 * The Vivid token pair, in localStorage under the key the integration guide
 * names. Deliberately not an httpOnly cookie: refresh tokens rotate, and only
 * a single browser can single-flight a refresh — concurrent server instances
 * racing one would invalidate the session for everybody.
 */
const KEY = "vivid_tokens";

/** Cached so reads are cheap and `getSnapshot` can return a stable reference. */
let cache: Tokens | null | undefined;
const listeners = new Set<() => void>();

function read(): Tokens | null {
  if (cache !== undefined) return cache;
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Tokens) : null;
    cache = parsed?.access_token && parsed?.refresh_token ? parsed : null;
  } catch {
    cache = null;
  }
  return cache;
}

function notify() {
  listeners.forEach((listener) => listener());
}

export function getTokens(): Tokens | null {
  return read();
}

export function setTokens(next: Tokens | null) {
  cache = next;
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable; the session lives for this page only.
  }
  notify();
  // Sign-in and sign-out should land in every open tab at once.
  channel()?.postMessage(next ? "signed-in" : "signed-out");
}

let broadcast: BroadcastChannel | null | undefined;

function channel(): BroadcastChannel | null {
  if (broadcast === undefined) {
    broadcast =
      typeof BroadcastChannel === "undefined"
        ? null
        : (() => {
            const created = new BroadcastChannel("vivid-auth");
            created.onmessage = () => {
              cache = undefined;
              notify();
            };
            return created;
          })();
  }
  return broadcast;
}

export function subscribeToTokens(listener: () => void) {
  listeners.add(listener);
  channel();
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== KEY) return;
    cache = undefined;
    notify();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
