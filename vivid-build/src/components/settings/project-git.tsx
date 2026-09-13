"use client";

import { NotAvailable } from "./not-available";

export function ProjectGit() {
  return (
    <NotAvailable
      title="Git"
      description="Sync this project with a repository."
      body="The builder API has no repository endpoints, so there is nothing to connect to yet. Every turn already stores a version you can restore from the project's History tab."
      instead={{ label: "All projects", href: "/projects" }}
    />
  );
}
