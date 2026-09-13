import type { Metadata } from "next";
import { LockedPage } from "@/components/settings/locked-page";

export const metadata: Metadata = { title: "Templates" };

export default function TemplatesPage() {
  return (
    <LockedPage
      title="Templates"
      tier="Business"
      description="Start every project from your own conventions instead of a blank prompt."
      points={[
        "Publish an approved project as a workspace template",
        "Pin design tokens, auth and data conventions into every new build",
        "Require a template for new projects in the workspace",
      ]}
    />
  );
}
