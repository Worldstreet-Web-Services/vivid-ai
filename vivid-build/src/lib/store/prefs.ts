"use client";

import { useSyncExternalStore } from "react";
import { prefsStore } from "./stores";
import type { Prefs, Snapshot } from "./types";

/**
 * Device preferences.
 *
 * What survived the move to a real backend: settings that belong to this
 * browser rather than to the account — code viewer options, the collapsed
 * sidebar, the last device preset. Identity, credits, team and API keys now
 * come from the server, so they are gone from here.
 */
export function usePrefs(): Snapshot<Prefs> {
  return useSyncExternalStore(prefsStore.subscribe, prefsStore.getSnapshot, prefsStore.getServerSnapshot);
}

export function updateWorkspacePrefs(patch: Partial<Prefs["workspace"]>) {
  prefsStore.update((current) => ({ ...current, workspace: { ...current.workspace, ...patch } }));
}
