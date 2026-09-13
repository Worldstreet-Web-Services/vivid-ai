import type { Metadata } from "next";
import { BillingSettings } from "@/components/settings/billing-settings";

export const metadata: Metadata = { title: "Billing" };

export default function BillingSettingsPage() {
  return <BillingSettings />;
}
