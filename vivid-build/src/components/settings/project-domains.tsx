"use client";

import { NotAvailable } from "./not-available";

export function ProjectDomains() {
  return (
    <NotAvailable
      title="Domains"
      description="Point your own domain at this project."
      body="Custom domains are not in the builder API yet. Publishing gives the project a live vivid-apps URL, shown on the Publish button in the workspace."
      instead={{ label: "All projects", href: "/projects" }}
    />
  );
}
