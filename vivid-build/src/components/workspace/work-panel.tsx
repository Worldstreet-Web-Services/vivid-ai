"use client";

import type { WorkspaceTab } from "@/components/app/data";
import type { Project } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import type { PreviewDevice } from "@/lib/preview/render";
import { CodeBrowser } from "./code-browser";
import { PreviewPane } from "./preview-pane";
import { ProjectDetails } from "./project-details";
import { VersionList } from "./version-list";

type Props = {
  className?: string;
  project: Project;
  tab: WorkspaceTab;
  device: PreviewDevice;
  preset: string;
  nonce: number;
  selectedFile: string | null;
  onFileSelect: (path: string) => void;
  onReloadPreview: () => void;
  onSend: (text: string) => void;
};

/** The right-hand pane. All chrome lives in WorkspaceTopBar. */
export function WorkPanel({
  className,
  project,
  tab,
  device,
  preset,
  nonce,
  selectedFile,
  onFileSelect,
  onReloadPreview,
  onSend,
}: Props) {
  const planning = project.mode === "plan";

  return (
    <section aria-label="Workspace" className={cn("min-w-0 flex-1 flex-col bg-bg-2 lg:flex-[1.15]", className)}>
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-[18px]">
        {tab === "preview" &&
          (planning ? (
            <EmptyTab
              title="Nothing built yet"
              body="Answer the questions in the chat, then approve the spec. The preview appears once the build starts."
            />
          ) : (
            <PreviewPane
              projectId={project.id}
              device={device}
              preset={preset}
              nonce={nonce}
              onSend={onSend}
              onReload={onReloadPreview}
            />
          ))}

        {tab === "code" &&
          (planning ? (
            <EmptyTab title="No files yet" body="The agent writes files once the spec is approved." />
          ) : (
            <CodeBrowser projectId={project.id} selectedFile={selectedFile} onFileSelect={onFileSelect} />
          ))}

        {tab === "history" && <VersionList projectId={project.id} onRestored={onReloadPreview} />}

        {tab === "more" && <ProjectDetails project={project} />}
      </div>
    </section>
  );
}

function EmptyTab({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line-2 px-6 py-12 text-center">
      <p className="text-sm font-semibold text-fg">{title}</p>
      <p className="mt-1.5 text-sm text-muted">{body}</p>
    </div>
  );
}
