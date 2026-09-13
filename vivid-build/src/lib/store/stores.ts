"use client";

import { createPersistedStore } from "./persisted-store";
import { SCHEMA_VERSION, type Prefs } from "./types";

const KEY = {
  prefs: "vb:v1:prefs",
} as const;

/* --------------------------------------------------------------- guards -- */

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const defaultPrefs = (): Prefs => ({
  v: SCHEMA_VERSION,
  workspace: {
    device: "desktop",
    codeWrap: false,
    codeFontSize: 12.5,
    expandedDirs: ["src", "preview"],
    sidebarCollapsed: false,
  },
});

/**
 * Merged over the defaults rather than trusted wholesale, so a record written
 * before identity and credits moved to the server still yields usable prefs
 * instead of being thrown away.
 */
function parsePrefs(raw: unknown): Prefs | null {
  if (!isObject(raw)) return null;
  const base = defaultPrefs();
  const workspace = isObject(raw.workspace) ? (raw.workspace as Partial<Prefs["workspace"]>) : {};
  return {
    v: SCHEMA_VERSION,
    workspace: { ...base.workspace, ...workspace },
  };
}

/* --------------------------------------------------------------- stores -- */

/**
 * The prototype kept whole projects in localStorage under `vb:v1:index` and
 * `vb:v1:project:<slug>`. That code is gone, but the records are not — they sit
 * in every existing browser costing megabytes of quota and never being read
 * again. Swept once, on first import.
 */
function sweepPrototypeData() {
  if (typeof window === "undefined") return;
  try {
    const dead = Object.keys(window.localStorage).filter(
      (name) => name === "vb:v1:index" || name.startsWith("vb:v1:project:"),
    );
    for (const name of dead) window.localStorage.removeItem(name);
  } catch {
    // A browser with storage blocked has nothing to sweep.
  }
}

sweepPrototypeData();

export const prefsStore = createPersistedStore<Prefs>({
  key: KEY.prefs,
  parse: parsePrefs,
  fallback: defaultPrefs,
});
