"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { ProjectGridSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { deleteProject, updateProject } from "@/lib/api/endpoints";
import { useProjects, type ProjectSort } from "@/lib/api/hooks";
import { toggleFavorite } from "@/lib/api/project-flags";
import { useFavorites } from "@/lib/api/hooks";
import type { Project } from "@/lib/api/types";
import { isRecent } from "@/lib/time";
import { buttonClass } from "@/lib/ui";
import { inputClass } from "@/components/settings/field";
import { ProjectCard, type ProjectActions } from "./project-card";
import { ProjectRow, ProjectRowHeader } from "./project-row";
import { ProjectsToolbar, type ProjectStatusFilter, type ProjectView } from "./projects-toolbar";

const EMPTY = {
  all: { title: "No projects yet", body: "Describe an app on the dashboard and it will show up here." },
  starred: { title: "Nothing starred", body: "Star a project to keep it close to hand." },
  filtered: { title: "No projects match", body: "Try a different search or clear the filters." },
} as const;

export function ProjectList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const filter = searchParams.get("filter");
  const query = searchParams.get("q") ?? "";
  const sort = (searchParams.get("sort") as ProjectSort | null) ?? "updated";
  const order = searchParams.get("order") === "asc" ? "asc" : "desc";
  const status = (searchParams.get("status") as ProjectStatusFilter | null) ?? "all";
  const view: ProjectView = searchParams.get("view") === "list" ? "list" : "grid";

  const snapshot = useProjects({ query, sort, order, status, favoritesOnly: filter === "starred" });
  const favorites = useFavorites();

  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [renaming, setRenaming] = useState<Project | null>(null);
  const [draftName, setDraftName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Project[] | null>(null);

  // The clock is only read after hydration, so relative times never get baked
  // into server HTML that is stale by the time anyone reads it.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const id = requestAnimationFrame(() => setNow(Date.now()));
    return () => cancelAnimationFrame(id);
  }, []);

  const setParams = useCallback(
    (patch: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (!value || value === "all" || (key === "view" && value === "grid")) params.delete(key);
        else params.set(key, value);
      }
      const next = params.toString();
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const projects = useMemo(() => (snapshot.status === "ready" ? snapshot.data : []), [snapshot]);

  const groups = useMemo(() => {
    if (now === null) return [{ heading: null, items: projects }];
    const recent = projects.filter((project) => isRecent(Date.parse(project.updated_at), 14, now));
    const earlier = projects.filter((project) => !isRecent(Date.parse(project.updated_at), 14, now));
    if (!recent.length || !earlier.length) return [{ heading: null, items: projects }];
    return [
      { heading: "Active in last 14 days", items: recent },
      { heading: "Earlier", items: earlier },
    ];
  }, [projects, now]);

  const actions: ProjectActions = {
    onStar: (project) => toggleFavorite(project.id),
    onCopyLink: (project) => {
      const url = `${window.location.origin}/projects/${project.id}`;
      navigator.clipboard?.writeText(url).then(
        () => toast("Link copied"),
        () => toast("Could not copy", "warn"),
      );
    },
    onRename: (project) => {
      setDraftName(project.name);
      setRenaming(project);
    },
    onSettings: (project) => router.push(`/settings/project/general?project=${project.id}`),
    onDelete: (project) => setConfirmDelete([project]),
  };

  const rename = async () => {
    const project = renaming;
    if (!project) return;
    setRenaming(null);
    try {
      await updateProject(project.id, { name: draftName.trim() || project.name });
      toast("Project renamed");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not rename", "warn");
    }
  };

  const removeAll = async (targets: Project[]) => {
    setConfirmDelete(null);
    exitSelecting();
    // Sequential on purpose: the list is short, and a partial failure should
    // name itself rather than disappear into a Promise.all rejection.
    let removed = 0;
    for (const project of targets) {
      try {
        await deleteProject(project.id);
        removed += 1;
      } catch (error) {
        toast(error instanceof Error ? error.message : `Could not delete ${project.name}`, "warn");
        break;
      }
    }
    if (removed) toast(`${removed} project${removed === 1 ? "" : "s"} deleted`, "warn");
  };

  const toggleSelect = (id: string) =>
    setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));

  const exitSelecting = () => {
    setSelecting(false);
    setSelected([]);
  };

  if (snapshot.status === "loading") return <ProjectGridSkeleton />;

  if (snapshot.status === "error") {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-line-2 px-6 py-12 text-center">
        <p className="text-base font-semibold text-fg">Could not load your projects</p>
        <p className="mt-1.5 text-sm text-muted">{snapshot.error.message}</p>
        <button type="button" onClick={snapshot.retry} className={buttonClass({ size: "sm", className: "mt-5" })}>
          Try again
        </button>
      </div>
    );
  }

  const filtering = Boolean(query) || status !== "all";
  const empty = filtering ? EMPTY.filtered : filter === "starred" ? EMPTY.starred : EMPTY.all;
  const selectedProjects = projects.filter((project) => selected.includes(project.id));

  return (
    <>
      <ProjectsToolbar
        query={query}
        sort={sort}
        order={order}
        status={status}
        view={view}
        selecting={selecting}
        onChange={setParams}
        onToggleSelecting={() => (selecting ? exitSelecting() : setSelecting(true))}
      />

      {projects.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line-2 px-6 py-12 text-center">
          <p className="text-base font-semibold text-fg">{empty.title}</p>
          <p className="mt-1.5 text-sm text-muted">{empty.body}</p>
          {filtering ? (
            <button
              type="button"
              onClick={() => setParams({ q: "", status: "all" })}
              className={buttonClass({ variant: "secondary", size: "sm", className: "mt-5" })}
            >
              Clear filters
            </button>
          ) : (
            <Link href="/dashboard" className={buttonClass({ size: "sm", className: "mt-5" })}>
              Start a project
            </Link>
          )}
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.heading ?? "all"} className="mt-6">
            {group.heading && (
              <h2 className="mb-3 text-[13px] font-semibold text-muted">{group.heading}</h2>
            )}
            {view === "list" && <ProjectRowHeader />}
            <ul
              className={cn(
                view === "grid"
                  ? "grid grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] gap-5"
                  : "flex flex-col",
              )}
            >
              {group.items.map((project) =>
                view === "grid" ? (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    starred={favorites.includes(project.id)}
                    actions={actions}
                    selecting={selecting}
                    selected={selected.includes(project.id)}
                    onToggleSelect={toggleSelect}
                    now={now}
                  />
                ) : (
                  <ProjectRow
                    key={project.id}
                    project={project}
                    starred={favorites.includes(project.id)}
                    actions={actions}
                    selecting={selecting}
                    selected={selected.includes(project.id)}
                    onToggleSelect={toggleSelect}
                    now={now}
                  />
                ),
              )}
            </ul>
          </section>
        ))
      )}

      {selecting && (
        <div className="fixed inset-x-0 bottom-5 z-100 flex justify-center px-4">
          <div className="flex flex-wrap items-center gap-3 rounded-full border border-line-2 bg-surface px-4 py-2.5 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)]">
            <button
              type="button"
              onClick={() =>
                setSelected(selected.length === projects.length ? [] : projects.map((project) => project.id))
              }
              className="cursor-pointer text-[13px] font-semibold text-fg"
            >
              {selected.length === projects.length ? "Clear selection" : `Select all (${projects.length})`}
            </button>
            <span className="text-[13px] text-muted-3">{selected.length} selected</span>
            <button
              type="button"
              disabled={!selected.length}
              onClick={() => {
                selectedProjects.forEach((project) => toggleFavorite(project.id));
                toast(`${selected.length} updated`);
              }}
              className={buttonClass({
                variant: "secondary",
                size: "sm",
                className: "disabled:cursor-not-allowed disabled:opacity-50",
              })}
            >
              Star
            </button>
            <button
              type="button"
              disabled={!selected.length}
              onClick={() => setConfirmDelete(selectedProjects)}
              // --warn is muted enough in dark that a bare label reads as
              // disabled; the tint is what makes it look pressable.
              className="cursor-pointer rounded-full bg-warn/20 px-4 py-2 text-[13px] font-bold text-fg transition-colors hover:bg-warn/35 disabled:cursor-not-allowed disabled:bg-transparent disabled:text-muted-3"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={exitSelecting}
              className="cursor-pointer text-[13px] font-semibold text-muted hover:text-fg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {renaming && (
        <Dialog title="Rename project" size="sm" onClose={() => setRenaming(null)}>
          <div className="flex flex-col gap-4 px-5 py-4">
            <input
              autoFocus
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                void rename();
              }}
              className={inputClass}
            />
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setRenaming(null)}
                className={buttonClass({ variant: "secondary", size: "sm" })}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void rename()}
                className={buttonClass({ size: "sm" })}
              >
                Rename
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {confirmDelete && (
        <Dialog
          title={
            confirmDelete.length === 1 ? `Delete ${confirmDelete[0].name}?` : `Delete ${confirmDelete.length} projects?`
          }
          description="This removes every file and the whole history. It cannot be undone."
          size="sm"
          onClose={() => setConfirmDelete(null)}
        >
          <div className="flex justify-end gap-2.5 px-5 py-4">
            <button
              type="button"
              onClick={() => setConfirmDelete(null)}
              className={buttonClass({ variant: "secondary", size: "sm" })}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void removeAll(confirmDelete)}
              className={buttonClass({ size: "sm" })}
            >
              Delete
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
