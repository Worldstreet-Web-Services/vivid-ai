"use client";

import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { buttonClass } from "@/lib/ui";
import { projectStatus, useProjects } from "@/lib/api/hooks";
import { PageHeader } from "./page-header";
import { SettingRow, SettingRows } from "./setting-row";
import { SettingsSection } from "./settings-section";

/** Unlocked by things you have actually done, so the page isn't just a poster. */
const SKILLS = [
  { id: "first-build", name: "First build", body: "Ship your first project.", needs: 1 },
  { id: "prolific", name: "Prolific", body: "Build three projects.", needs: 3 },
  { id: "portfolio", name: "Portfolio", body: "Build five projects.", needs: 5 },
  { id: "shipper", name: "Shipper", body: "Publish a project to a live URL.", needs: -1 },
] as const;

export function SkillsSettings() {
  const snapshot = useProjects();
  const projects = useMemo(() => (snapshot.status === "ready" ? snapshot.data : []), [snapshot]);

  if (snapshot.status === "error") {
    return (
      <SettingsSection
        title="Skills"
        description={snapshot.error.message}
        footer={
          <button type="button" onClick={snapshot.retry} className={buttonClass({ variant: "secondary", size: "sm" })}>
            Try again
          </button>
        }
      >
        <p className="text-sm text-muted">Skills are worked out from your projects, which could not be loaded.</p>
      </SettingsSection>
    );
  }

  if (snapshot.status !== "ready") {
    return (
      <SettingsSection title="Skills">
        <Skeleton className="h-32" />
      </SettingsSection>
    );
  }

  const built = projects.length;
  const published = projects.some((project) => projectStatus(project) === "live");
  const unlocked = (skill: (typeof SKILLS)[number]) =>
    skill.needs === -1 ? published : built >= skill.needs;
  const count = SKILLS.filter(unlocked).length;

  return (
    <>
      <PageHeader
        title="Skills"
        description="Earned by building real things. Showcase them on your profile."
      />

      <SettingsSection
        title="Your skills"
        description={`${count} of ${SKILLS.length} unlocked.`}
        note="Derived from the projects on your account."
      >
        <SettingRows>
          {SKILLS.map((skill) => {
            const on = unlocked(skill);
            return (
              <SettingRow
                key={skill.id}
                label={
                  <span className={on ? "text-fg" : "text-muted"}>
                    {skill.name}
                  </span>
                }
                description={skill.body}
                action={
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-bold",
                      on ? "bg-tint text-fg" : "text-muted-3",
                    )}
                  >
                    {on ? "Unlocked" : "Locked"}
                  </span>
                }
              />
            );
          })}
        </SettingRows>
      </SettingsSection>
    </>
  );
}
