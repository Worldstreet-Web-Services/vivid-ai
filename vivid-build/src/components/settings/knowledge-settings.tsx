"use client";

import { NotAvailable } from "./not-available";

export function KnowledgeSettings() {
  return (
    <NotAvailable
      title="Knowledge"
      description="Standing instructions the agent reads before every build."
      body="There is no project-knowledge endpoint yet. The spec plays this role instead: it is written during planning and editable from the workspace, and the agent builds against it."
      instead={{ label: "All projects", href: "/projects" }}
    />
  );
}
