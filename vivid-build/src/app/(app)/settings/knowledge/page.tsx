import type { Metadata } from "next";
import { KnowledgeSettings } from "@/components/settings/knowledge-settings";

export const metadata: Metadata = { title: "Knowledge" };

export default function KnowledgePage() {
  return <KnowledgeSettings />;
}
