"use client";

import { Check, ChevronDown, LayoutGrid, List, Search, SquareDashedMousePointer } from "lucide-react";
import { Menu } from "@/components/ui/menu";
import { cn } from "@/lib/cn";
import type { ProjectSort } from "@/lib/api/hooks";

export type ProjectView = "grid" | "list";
export type ProjectStatusFilter = "all" | "draft" | "live";

export const SORT_LABELS: Record<ProjectSort, string> = {
  updated: "Last edited",
  created: "Created",
  name: "Name",
};

const STATUS_LABELS: Record<ProjectStatusFilter, string> = {
  all: "Any status",
  live: "Published",
  draft: "Not published",
};

type Props = {
  query: string;
  sort: ProjectSort;
  order: "asc" | "desc";
  status: ProjectStatusFilter;
  view: ProjectView;
  selecting: boolean;
  onChange: (patch: Record<string, string>) => void;
  onToggleSelecting: () => void;
};

const control =
  "flex items-center gap-1.5 rounded-xl border border-line-2 bg-surface px-3 py-2 text-[13px] font-semibold text-fg-2 transition-colors hover:border-line-3";

export function ProjectsToolbar({
  query,
  sort,
  order,
  status,
  view,
  selecting,
  onChange,
  onToggleSelecting,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-0 flex-1 basis-[200px]">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-3" />
        <input
          value={query}
          onChange={(event) => onChange({ q: event.target.value })}
          placeholder="Search projects…"
          aria-label="Search projects"
          className="w-full rounded-xl border border-line-2 bg-surface py-2 pr-3.5 pl-9 text-[13px] text-fg outline-none transition-colors focus-visible:border-line-3"
        />
      </div>

      <Menu
        ariaLabel="Sort projects"
        label={
          <span className={control}>
            {SORT_LABELS[sort]}
            <Chevron />
          </span>
        }
        items={[
          ...(Object.keys(SORT_LABELS) as ProjectSort[]).map((key) => ({
            label: SORT_LABELS[key],
            trailing: key === sort ? <Check className="size-3.5" /> : undefined,
            onSelect: () => onChange({ sort: key }),
          })),
          { type: "divider" as const },
          {
            label: "Newest first",
            trailing: order === "desc" ? <Check className="size-3.5" /> : undefined,
            onSelect: () => onChange({ order: "desc" }),
          },
          {
            label: "Oldest first",
            trailing: order === "asc" ? <Check className="size-3.5" /> : undefined,
            onSelect: () => onChange({ order: "asc" }),
          },
        ]}
      />

      <Menu
        ariaLabel="Filter by status"
        label={
          <span className={control}>
            {STATUS_LABELS[status]}
            <Chevron />
          </span>
        }
        items={(Object.keys(STATUS_LABELS) as ProjectStatusFilter[]).map((key) => ({
          label: STATUS_LABELS[key],
          trailing: key === status ? <Check className="size-3.5" /> : undefined,
          onSelect: () => onChange({ status: key }),
        }))}
      />

      <button
        type="button"
        aria-pressed={selecting}
        onClick={onToggleSelecting}
        className={cn(control, selecting && "border-transparent bg-surface-2 text-fg")}
      >
        <SquareDashedMousePointer aria-hidden className="size-4" />
        Select
      </button>

      <div role="group" aria-label="View" className="flex gap-1 rounded-xl border border-line-2 bg-surface p-1">
        {(["grid", "list"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={view === option}
            aria-label={option === "grid" ? "Grid view" : "List view"}
            onClick={() => onChange({ view: option })}
            className={cn(
              "flex cursor-pointer items-center rounded-lg px-2 py-1.5 transition-colors",
              view === option ? "bg-surface-2 text-fg" : "text-muted hover:text-fg",
            )}
          >
            {option === "grid" ? (
              <LayoutGrid aria-hidden className="size-4" />
            ) : (
              <List aria-hidden className="size-4" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function Chevron() {
  return <ChevronDown aria-hidden className="size-3.5 text-muted-2" />;
}
