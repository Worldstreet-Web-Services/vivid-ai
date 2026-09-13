import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ProjectList } from "@/components/app/project-list";
import { ProjectGridSkeleton } from "@/components/ui/skeleton";
import { buttonClass } from "@/lib/ui";

export const metadata: Metadata = {
  title: "Projects",
};

export default function ProjectsPage() {
  return (
    <div className="mx-auto w-full max-w-[1180px] px-5 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-[clamp(24px,2.6vw,32px)] font-extrabold tracking-[-0.04em]">Projects</h1>
        <Link href="/dashboard" className={buttonClass({ size: "sm" })}>
          Create
        </Link>
      </div>
      {/* The list reads ?q= ?sort= ?status= ?view= ?filter= from the URL. */}
      <Suspense fallback={<ProjectGridSkeleton />}>
        <ProjectList />
      </Suspense>
    </div>
  );
}
