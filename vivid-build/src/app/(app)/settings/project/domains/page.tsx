import type { Metadata } from "next";
import { ProjectDomains } from "@/components/settings/project-domains";

export const metadata: Metadata = { title: "Domains" };

export default function ProjectDomainsPage() {
  return <ProjectDomains />;
}
