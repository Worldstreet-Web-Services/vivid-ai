"use client";

import { ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { key, listPublishes } from "@/lib/api/endpoints";
import type { PublishStatus } from "@/lib/api/types";
import { useResource } from "@/lib/api/use-resource";
import { cn } from "@/lib/cn";

const timeFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

const TONE: Record<PublishStatus, string> = {
  live: "bg-[#4ade80]",
  pending: "bg-muted-2",
  failed: "bg-warn",
};

/** Past deploys, newest first — including the failed ones and why. */
export function DeployList({ projectId }: { projectId: string }) {
  // Polled while anything is pending, so a deploy started elsewhere still lands.
  const publishes = useResource(key.publishes(projectId), () => listPublishes(projectId), { refreshMs: 15_000 });

  if (publishes.status === "loading") return <Skeleton className="h-16" />;
  if (publishes.status === "error") return <p className="text-sm text-muted">{publishes.error.message}</p>;

  if (!publishes.data.length) {
    return <p className="text-sm text-muted">Not published yet. The Publish button puts this app on a live URL.</p>;
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {publishes.data.map((deploy) => (
        <li key={deploy.id} className="flex flex-wrap items-start gap-2.5">
          <span aria-hidden className={cn("mt-1.5 size-1.5 flex-none rounded-full", TONE[deploy.status])} />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-fg">
              {deploy.status === "live" ? "Live" : deploy.status === "pending" ? "Publishing…" : "Failed"}
              <span className="ml-2 font-medium text-muted-3">{timeFormat.format(Date.parse(deploy.created_at))}</span>
            </p>
            {deploy.url && deploy.status === "live" && (
              <a
                href={deploy.url}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center gap-1 text-[12px] text-muted underline underline-offset-2 hover:text-fg"
              >
                {deploy.url.replace(/^https?:\/\//, "")}
                <ExternalLink aria-hidden className="size-3" />
              </a>
            )}
            {deploy.error && (
              <pre className="mt-1.5 max-h-28 overflow-auto rounded-lg bg-warn/15 p-2 font-mono text-[11px] leading-[1.5] text-fg-2">
                {deploy.error}
              </pre>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
