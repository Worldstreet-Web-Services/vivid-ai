import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkspaceSkeleton } from "@/components/ui/skeleton";
import { ProjectRoute } from "@/components/workspace/project-route";

// Deliberately no generateStaticParams and no dynamicParams: projects live in
// the browser's storage, so the server cannot know which ids exist. Pinning
// them at build time is what made every user-created project a hard 404.

export const metadata: Metadata = {
  // The real name is client-only; the workspace sets document.title on mount.
  title: "Project",
};

export default async function ProjectPage({ params }: PageProps<"/projects/[projectId]">) {
  const { projectId } = await params;

  // useSearchParams inside the workspace needs a Suspense boundary on a static
  // route; the skeleton also covers the store's hydration gap.
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <ProjectRoute projectId={projectId} />
    </Suspense>
  );
}
