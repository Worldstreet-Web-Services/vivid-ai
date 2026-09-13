import type { Metadata } from "next";
import { ProjectConnectors } from "@/components/settings/project-connectors";

export const metadata: Metadata = { title: "Connectors" };

export default function ProjectConnectorsPage() {
  return <ProjectConnectors />;
}
