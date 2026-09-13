"use client";

import { createPersistedStore } from "@/lib/store/persisted-store";

/**
 * Per-device project flags the backend has no field for.
 *
 * Only `favorite` so far, which keeps the Starred filter and the star on a
 * project card working. It is a personal marker on one device, not shared
 * state, so localStorage is the honest home for it rather than a field we wish
 * the API had.
 */
export type ProjectFlags = { favorites: string[] };

export const flagsStore = createPersistedStore<ProjectFlags>({
  key: "vb:v1:project-flags",
  parse: (raw) =>
    raw && typeof raw === "object" && Array.isArray((raw as ProjectFlags).favorites)
      ? { favorites: (raw as ProjectFlags).favorites.filter((id) => typeof id === "string") }
      : null,
  fallback: () => ({ favorites: [] }),
});

export function isFavorite(id: string) {
  return flagsStore.get().favorites.includes(id);
}

export function toggleFavorite(id: string) {
  flagsStore.update((current) => ({
    favorites: current.favorites.includes(id)
      ? current.favorites.filter((other) => other !== id)
      : [...current.favorites, id],
  }));
}
