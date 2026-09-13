import type { Metadata } from "next";
import { ApiKeySettings } from "@/components/settings/api-key-settings";

export const metadata: Metadata = { title: "API keys" };

export default function ApiKeysSettingsPage() {
  return <ApiKeySettings />;
}
