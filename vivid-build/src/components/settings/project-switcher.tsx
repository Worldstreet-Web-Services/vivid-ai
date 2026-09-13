"use client";

import { ChevronDown } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Menu } from "@/components/ui/menu";
import { useSettingsProject } from "./settings-project";

/** Re-points the project-scoped settings pages at a different project. */
export function ProjectSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const { projectId, projects } = useSettingsProject();

  if (projects.length < 2) return null;
  const current = projects.find((project) => project.id === projectId);

  return (
    <Menu
      ariaLabel="Switch project"
      align="end"
      label={
        <span className="flex items-center gap-1.5 rounded-lg border border-line-2 px-3 py-1.5 text-xs font-semibold text-fg-2">
          {current?.name ?? "Project"}
          <ChevronDown aria-hidden className="size-3.5 flex-none text-muted-2" />
        </span>
      }
      items={projects.map((project) => ({
        label: project.name,
        onSelect: () => router.push(`${pathname}?project=${project.id}`),
      }))}
    />
  );
}
