import type { Metadata } from "next";
import { LockedPage } from "@/components/settings/locked-page";

export const metadata: Metadata = { title: "Groups" };

export default function GroupsPage() {
  return (
    <LockedPage
      title="Groups"
      tier="Business"
      description="Grant access to sets of projects by team, not one person at a time."
      points={[
        "Bundle members into groups and assign project access in one move",
        "Sync groups from your identity provider",
        "Per-group credit limits and spend reporting",
      ]}
    />
  );
}
