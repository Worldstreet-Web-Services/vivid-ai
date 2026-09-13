"use client";

import { ArrowUpRight, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function SettingsTopBar() {
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <button
        type="button"
        onClick={() => router.back()}
        className="flex cursor-pointer items-center gap-1.5 text-[13px] font-semibold text-muted transition-colors hover:text-fg"
      >
        <ChevronLeft aria-hidden className="size-4" />
        Go back
      </button>
      {/* Goes to the project list rather than whichever project the Project
          group happens to be scoped to — that scoping is not visible from here. */}
      <Link
        href="/projects"
        className="text-[13px] font-semibold text-muted transition-colors hover:text-fg"
      >
        <span className="flex items-center gap-1.5">
          All projects
          <ArrowUpRight aria-hidden className="size-3.5" />
        </span>
      </Link>
    </div>
  );
}
