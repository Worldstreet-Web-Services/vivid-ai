"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjects } from "@/lib/api/hooks";
import { useSession } from "@/lib/api/session";
import { PageHeader } from "./page-header";
import { RowValue, SettingRow, SettingRows } from "./setting-row";
import { SettingsSection } from "./settings-section";
import { displayEmail, displayName } from "@/lib/api/user";

export const SEAT_LIMIT = 5;

export function WorkspaceSettings() {
  const { user } = useSession();
  const projectsSnapshot = useProjects();

  const projectCount = projectsSnapshot.status === "ready" ? projectsSnapshot.data.length : 0;

  if (!user) {
    return (
      <SettingsSection title="Workspace">
        <Skeleton className="h-28" />
      </SettingsSection>
    );
  }

  // Projects belong to the account that made them and the API exposes no
  // members, so the workspace is exactly one person: you.
  const used = 1;
  const name = displayName(user);

  return (
    <>
      <PageHeader title="Workspace" description="Your workspace, its seats and what lives in it." />

      <SettingsSection
        title="General"
        note="Named after your account. There is no separate workspace name to set."
      >
        <div className="flex items-center gap-4">
          <Avatar name={name} size="lg" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-fg">{name}</p>
            <p className="mt-0.5 text-[13px] leading-[1.5] text-muted">{displayEmail(user) ?? "No email on file"}</p>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Seats" description="Every member and pending invite uses one seat.">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="font-semibold text-fg">
            {used} of {SEAT_LIMIT} used
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
          <div
            className="h-1.5 rounded-full bg-bar transition-[width] duration-500"
            style={{ width: `${Math.min(100, Math.round((used / SEAT_LIMIT) * 100))}%` }}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold">
          <Link href="/settings/people" className="text-fg underline underline-offset-2">
            Manage people
          </Link>
        </div>
      </SettingsSection>

      <SettingsSection title="Contents" description="What this workspace holds today.">
        <SettingRows>
          <SettingRow label="Projects" action={<RowValue>{projectCount}</RowValue>} />
          <SettingRow label="Members" action={<RowValue>{used}</RowValue>} />
        </SettingRows>
      </SettingsSection>
    </>
  );
}
