"use client";

import { NotAvailable } from "./not-available";

export function ApiKeySettings() {
  return (
    <NotAvailable
      title="API keys"
      description="Programmatic access to your projects."
      body="The integration guide names a key-creation endpoint but never specifies it, so there is no way to mint, list or revoke a key yet. Signing in through the app is the only supported way to reach the API today."
      instead={{ label: "Account settings", href: "/settings/account" }}
    />
  );
}
