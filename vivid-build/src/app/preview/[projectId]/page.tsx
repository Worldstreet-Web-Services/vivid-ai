import type { Metadata } from "next";
import { Suspense } from "react";
import { FullPreview } from "@/components/workspace/full-preview";

export const metadata: Metadata = {
  title: "Preview",
  robots: { index: false, follow: false },
};

export default async function PreviewPage({ params }: PageProps<"/preview/[projectId]">) {
  const { projectId } = await params;
  return (
    <Suspense fallback={null}>
      <FullPreview projectId={projectId} />
    </Suspense>
  );
}
