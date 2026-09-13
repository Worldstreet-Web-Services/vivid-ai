"use client";

import { SSR_SNAPSHOT, type Snapshot } from "./types";

export type PersistedStore<T> = {
  key: string;
  subscribe: (listener: () => void) => () => void;
  /**
   * MUST return a cached reference. A snapshot getter may never construct a
   * value — no .map, .filter, .slice, no object literal — or React 19 will
   * re-render forever. Derive in useMemo inside components instead.
   */
  getSnapshot: () => Snapshot<T>;
  getServerSnapshot: () => Snapshot<T>;
  /** Reads through the cache. Returns the fallback before hydration. */
  get: () => T;
  set: (next: T) => void;
  update: (recipe: (current: T) => T) => void;
  /** Drops the cache so the next read re-parses storage. */
  invalidate: () => void;
};

type Registered = { key: string; invalidate: () => void; notify: () => void };

const registry = new Map<string, Registered>();
let subscriberCount = 0;
let listening = false;

/**
 * A single window listener for every store, installed on the 0 -> 1 subscriber
 * transition. Registering one per subscriber (as the old projects-store did)
 * only worked by accident once more than one key was in play.
 */
function onStorage(event: StorageEvent) {
  if (event.key === null) {
    // Whole-origin clear: every store is stale.
    registry.forEach((store) => {
      store.invalidate();
      store.notify();
    });
    return;
  }
  const store = registry.get(event.key);
  if (!store) return;
  store.invalidate();
  store.notify();
}

function addSubscriber() {
  subscriberCount += 1;
  if (listening || typeof window === "undefined") return;
  window.addEventListener("storage", onStorage);
  listening = true;
}

function removeSubscriber() {
  subscriberCount -= 1;
  if (subscriberCount > 0 || !listening) return;
  window.removeEventListener("storage", onStorage);
  listening = false;
}

export type StorageStatus = "ok" | "full" | "unavailable";

let storageStatus: StorageStatus = "ok";
const statusListeners = new Set<() => void>();

export const getStorageStatus = () => storageStatus;

export function subscribeToStorageStatus(listener: () => void) {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

function setStorageStatus(next: StorageStatus) {
  if (storageStatus === next) return;
  storageStatus = next;
  statusListeners.forEach((listener) => listener());
}

export function isQuotaError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED")
  );
}

type Options<T> = {
  key: string;
  /** Validates and migrates raw parsed JSON. Return null to fall back. */
  parse: (raw: unknown) => T | null;
  /** Called when nothing valid is stored. Must be cheap and pure. */
  fallback: () => T;
  /**
   * Called when a write fails with a quota error. Return a smaller value to
   * retry once, or null to give up and keep serving from memory.
   */
  evict?: (value: T) => T | null;
};

export function createPersistedStore<T>({ key, parse, fallback, evict }: Options<T>): PersistedStore<T> {
  type Ready = { status: "ready"; data: T };
  const listeners = new Set<() => void>();
  let cache: Ready | null = null;
  /** Survives quota failures so the session keeps working from memory. */
  let memory: T | null = null;

  const read = (): Ready => {
    if (cache) return cache;
    let value: T | null = memory;
    if (value === null) {
      try {
        const raw = localStorage.getItem(key);
        value = raw === null ? null : parse(JSON.parse(raw) as unknown);
      } catch {
        // Malformed JSON, blocked storage, or a failed guard: fall back rather
        // than throw. A broken shard must not take the whole app down.
        value = null;
      }
    }
    cache = { status: "ready", data: value ?? fallback() };
    return cache;
  };

  const notify = () => listeners.forEach((listener) => listener());
  const invalidate = () => {
    cache = null;
  };

  registry.set(key, { key, invalidate, notify });

  const persist = (value: T) => {
    memory = value;
    try {
      localStorage.setItem(key, JSON.stringify(value));
      setStorageStatus("ok");
      return;
    } catch (error) {
      if (!isQuotaError(error)) {
        setStorageStatus("unavailable");
        return;
      }
    }
    // One eviction pass, then give up and keep the value in memory. Losing the
    // user's current work to a quota error is never the right trade.
    const smaller = evict?.(value) ?? null;
    if (smaller === null) {
      setStorageStatus("full");
      return;
    }
    memory = smaller;
    try {
      localStorage.setItem(key, JSON.stringify(smaller));
      setStorageStatus("ok");
    } catch {
      setStorageStatus("full");
    }
  };

  const set = (next: T) => {
    cache = { status: "ready", data: next };
    persist(next);
    notify();
  };

  return {
    key,
    subscribe(listener) {
      listeners.add(listener);
      addSubscriber();
      return () => {
        listeners.delete(listener);
        removeSubscriber();
      };
    },
    getSnapshot: read,
    getServerSnapshot: () => SSR_SNAPSHOT as Snapshot<T>,
    get: () => read().data,
    set,
    update(recipe) {
      set(recipe(read().data));
    },
    invalidate,
  };
}
