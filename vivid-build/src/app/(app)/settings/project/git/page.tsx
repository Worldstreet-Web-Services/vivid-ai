import type { Metadata } from "next";
import { ProjectGit } from "@/components/settings/project-git";

export const metadata: Metadata = { title: "Git" };

export default function ProjectGitPage() {
  return <ProjectGit />;
}
