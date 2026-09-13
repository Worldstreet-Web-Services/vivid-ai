"use client";

import { useEffect } from "react";
import { WorkspaceSkeleton } from "@/components/ui/skeleton";
import { useProject } from "@/lib/api/hooks";
import { key, listMessages } from "@/lib/api/endpoints";
import { useResource } from "@/lib/api/use-resource";
import { buttonClass } from "@/lib/ui";
import Link from "next/link";
import { ProjectWorkspace } from "./project-workspace";
import { toUIMessages } from "./chat/use-project-chat";

/**
 * Loads a project and its thread before the workspace mounts.
 *
 * Both are prerequisites: `useChat` treats its `messages` as an initial value
 * and ignores later changes, so mounting before the thread arrives would show
 * an empty conversation that never fills in.
 */
export function ProjectRoute({ projectId }: { projectId: string }) {
  const project = useProject(projectId);
  const messages = useResource(key.messages(projectId), () => listMessages(projectId));

  const name = project.status === "ready" ? project.data.name : null;
  useEffect(() => {
    if (name) document.title = `${name} · VividBuild`;
  }, [name]);

  if (project.status === "error" || messages.status === "error") {
    const error = project.status === "error" ? project.error : messages.status === "error" ? messages.error : null;
    const missing = error?.status === 404;
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center">
        <div>
          <p className="text-base font-semibold text-fg">
            {missing ? "That project no longer exists" : "Could not open this project"}
          </p>
          <p className="mt-1.5 text-sm text-muted">{missing ? projectId : error?.message}</p>
          <Link href="/projects" className={buttonClass({ size: "sm", className: "mt-5" })}>
            All projects
          </Link>
        </div>
      </div>
    );
  }

  if (project.status !== "ready" || messages.status !== "ready") return <WorkspaceSkeleton />;

  return (
    <ProjectWorkspace
      // Remounts on a project change, so the chat transport and its initial
      // thread can never belong to the previous project.
      key={projectId}
      project={project.data}
      initialMessages={toUIMessages(messages.data)}
    />
  );
}
