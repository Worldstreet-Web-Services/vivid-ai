import type { Metadata } from "next";
import { SkillsSettings } from "@/components/settings/skills-settings";

export const metadata: Metadata = { title: "Skills" };

export default function SkillsPage() {
  return <SkillsSettings />;
}
