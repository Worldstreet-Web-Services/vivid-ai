"use client";

import { NotAvailable } from "./not-available";

export function BillingSettings() {
  return (
    <NotAvailable
      title="Plans & usage"
      description="What you are on and what you have used."
      body="The API has no plan, credit or payment endpoints on the account; the only usage it reports at all is per project, and nothing bills against it."
      instead={{ label: "All projects", href: "/projects" }}
    />
  );
}
