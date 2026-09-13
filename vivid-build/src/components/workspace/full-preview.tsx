"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useProject } from "@/lib/api/hooks";
import { buttonClass } from "@/lib/ui";
import { DEFAULT_PRESET, type PreviewDevice } from "@/lib/preview/render";
import { DeviceControls } from "./device-controls";
import { PreviewSurface } from "./preview-surface";

/** The built app at full browser width, with a slim bar of its own. */
export function FullPreview({ projectId }: { projectId: string }) {
  const project = useProject(projectId);
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [preset, setPreset] = useState(DEFAULT_PRESET.desktop);
  const [nonce, setNonce] = useState(0);

  if (project.status === "error") {
    return (
      <div className="flex h-dvh items-center justify-center p-6 text-center">
        <div>
          <p className="text-base font-semibold text-fg">{project.error.message}</p>
          <Link href="/projects" className={buttonClass({ size: "sm", className: "mt-4" })}>
            All projects
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-bg-2">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <Link
          href={`/projects/${projectId}`}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-semibold text-muted transition-colors hover:text-fg"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Editor
        </Link>
        <span className="truncate text-[13px] font-bold text-fg">
          {project.status === "ready" ? project.data.name : ""}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <DeviceControls
            device={device}
            preset={preset}
            onChange={(nextDevice, nextPreset) => {
              setDevice(nextDevice);
              setPreset(nextPreset);
            }}
          />
          <button
            type="button"
            onClick={() => setNonce((n) => n + 1)}
            className="cursor-pointer rounded-lg border border-line-2 bg-surface px-2.5 py-1.5 text-[13px] font-semibold text-fg-2 transition-colors hover:text-fg"
          >
            Reload
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 justify-center bg-bg-2">
        <PreviewSurface projectId={projectId} device={device} preset={preset} nonce={nonce} />
      </div>
    </div>
  );
}
