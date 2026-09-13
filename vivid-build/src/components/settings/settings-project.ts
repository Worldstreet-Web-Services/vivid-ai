"use client";

import { useSearchParams } from "next/navigation";
import { useProject, useProjects } from "@/lib/api/hooks";

/**
 * Which project the Project group is scoped to.
 *
 * Lives in `?project=<id>` rather than a nested route, so every settings page
 * stays one flat segment instead of duplicating the whole tree per project.
 * Defaults to the most recently updated project.
 */
export function useSettingsProject() {
  const searchParams = useSearchParams();
  const snapshot = useProjects();
  const projects = snapshot.status === "ready" ? snapshot.data : [];
  const requested = searchParams.get("project");

  const projectId = (requested && projects.some((p) => p.id === requested) ? requested : projects[0]?.id) ?? null;

  return { projectId, projects, hydrated: snapshot.status === "ready" };
}

/** The scoped project, or null while loading / when none exist. */
export function useSettingsProjectDoc() {
  const { projectId, projects, hydrated } = useSettingsProject();
  const project = useProject(projectId ?? "__none__");
  return {
    doc: projectId && project.status === "ready" ? project.data : null,
    projectId,
    projects,
    hydrated: hydrated && project.status === "ready",
  };
}
