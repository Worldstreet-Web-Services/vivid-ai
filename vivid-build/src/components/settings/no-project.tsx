import Link from "next/link";
import { buttonClass } from "@/lib/ui";
import { SettingsSection } from "./settings-section";

/** Shown on project-scoped settings when the workspace has no projects yet. */
export function NoProject({ title }: { title: string }) {
  return (
    <SettingsSection title={title} description="These settings belong to a project.">
      <p className="text-sm leading-[1.6] text-muted">
        You have no projects yet. Build one and its settings will appear here.
      </p>
      <Link href="/dashboard" className={buttonClass({ size: "sm", className: "mt-4" })}>
        Start a project
      </Link>
    </SettingsSection>
  );
}
