"use client";

import { useMemo, useSyncExternalStore } from "react";
import { getProject, key, listProjects } from "./endpoints";
import { flagsStore } from "./project-flags";
import { useResource } from "./use-resource";
import type { Async, Project } from "./types";

export type ProjectSort = "updated" | "created" | "name";

export type ProjectListOptions = {
  /** Substring match against the name and the brief. */
  query?: string;
  status?: "all" | "draft" | "live";
  sort?: ProjectSort;
  /** "desc" is newest / Z-A first. */
  order?: "asc" | "desc";
  favoritesOnly?: boolean;
};

/** The card subtitle. The API has no `prompt`, so the brief's first line stands in. */
export function projectSubtitle(project: Project): string {
  const source = project.brief_md ?? project.spec_md ?? "";
  const line = source
    .split("\n")
    .map((raw) => raw.replace(/^#+\s*/, "").trim())
    .find((raw) => raw.length > 0);
  return line ?? project.name;
}

/** Derived, because the API has no status field: a published project is live. */
export function projectStatus(project: Project): "draft" | "live" {
  return project.published_url ? "live" : "draft";
}

export function useFavorites(): string[] {
  return useSyncExternalStore(
    flagsStore.subscribe,
    () => flagsStore.getSnapshot(),
    () => flagsStore.getServerSnapshot(),
  ).status === "ready"
    ? flagsStore.get().favorites
    : [];
}

/**
 * The projects list, ordered and filtered.
 *
 * Filtering stays here rather than in the request: the API returns the whole
 * list and has no query parameters, and the set is small enough that a round
 * trip per keystroke would be worse than a `useMemo`.
 */
export function useProjects(options: ProjectListOptions = {}): Async<Project[]> & { refresh: () => void } {
  const resource = useResource(key.projects, () => listProjects());
  const favorites = useFavorites();
  const { query = "", status = "all", sort = "updated", order = "desc", favoritesOnly = false } = options;

  const filtered = useMemo(() => {
    if (resource.status !== "ready") return null;
    const needle = query.trim().toLowerCase();

    const projects = resource.data
      .filter((project) => status === "all" || projectStatus(project) === status)
      .filter((project) => !favoritesOnly || favorites.includes(project.id))
      .filter(
        (project) =>
          !needle ||
          project.name.toLowerCase().includes(needle) ||
          projectSubtitle(project).toLowerCase().includes(needle),
      );

    // Compared ascending, then flipped, so "order" means one thing everywhere.
    return [...projects].sort((a, b) => {
      const delta =
        sort === "name"
          ? a.name.localeCompare(b.name)
          : sort === "created"
            ? Date.parse(a.created_at) - Date.parse(b.created_at)
            : Date.parse(a.updated_at) - Date.parse(b.updated_at);
      return order === "asc" ? delta : -delta;
    });
  }, [resource, query, status, sort, order, favoritesOnly, favorites]);

  if (filtered === null) return resource as Async<Project[]> & { refresh: () => void };
  return { status: "ready", data: filtered, refresh: resource.refresh };
}

export function useProject(id: string) {
  return useResource(key.project(id), () => getProject(id));
}
