"use client";

import { NotAvailable } from "./not-available";

export function PeopleSettings() {
  return (
    <NotAvailable
      title="People"
      description="Who can see and build in this workspace."
      body="The builder API has no members, invites or roles — every project belongs to the account that created it — so there is nobody to add here yet."
      instead={{ label: "All projects", href: "/projects" }}
    />
  );
}
