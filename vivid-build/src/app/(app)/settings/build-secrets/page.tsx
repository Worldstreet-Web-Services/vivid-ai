import type { Metadata } from "next";
import { LockedPage } from "@/components/settings/locked-page";

export const metadata: Metadata = { title: "Build secrets" };

export default function BuildSecretsPage() {
  return (
    <LockedPage
      title="Build secrets"
      tier="Enterprise"
      description="Inject credentials at build time without them ever touching a project file."
      points={[
        "Workspace-wide secrets available to every build",
        "Scoped per environment, with an audit trail on every read",
        "Values are write-only — nobody can read them back, including you",
      ]}
    />
  );
}
