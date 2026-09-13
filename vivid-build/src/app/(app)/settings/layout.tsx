import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { SettingsNav } from "@/components/settings/settings-nav";
import { SettingsTopBar } from "@/components/settings/settings-top-bar";
import { Skeleton } from "@/components/ui/skeleton";

function SettingsPageSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-28 rounded-2xl" />
    </div>
  );
}

export const metadata: Metadata = {
  title: { default: "Settings", template: "%s · Settings · VividBuild" },
};

export default function SettingsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="mx-auto w-full max-w-[1180px] px-5 py-6 sm:px-6">
      {/* Both the nav and the pages read ?project=, so they need a boundary. */}
      <Suspense fallback={null}>
        <SettingsTopBar />
      </Suspense>

      <div className="mt-5 grid gap-5 md:grid-cols-[210px_1fr]">
        <Suspense fallback={null}>
          <SettingsNav />
        </Suspense>
        {/* Project-scoped pages read ?project=, so they need their own boundary
            or the static prerender fails. */}
        <Suspense fallback={<SettingsPageSkeleton />}>
          <div className="flex min-w-0 flex-col gap-3">{children}</div>
        </Suspense>
      </div>
    </div>
  );
}
