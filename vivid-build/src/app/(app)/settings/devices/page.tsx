import type { Metadata } from "next";
import { DevicesSettings } from "@/components/settings/devices-settings";

export const metadata: Metadata = { title: "Devices & apps" };

export default function DevicesPage() {
  return <DevicesSettings />;
}
