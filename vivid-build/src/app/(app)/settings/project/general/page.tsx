import type { Metadata } from "next";
import { ProjectGeneral } from "@/components/settings/project-general";

export const metadata: Metadata = { title: "General" };

export default function ProjectGeneralPage() {
  return <ProjectGeneral />;
}
