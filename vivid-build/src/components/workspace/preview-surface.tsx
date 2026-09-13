"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { getPreview, key } from "@/lib/api/endpoints";
import type { PreviewInfo } from "@/lib/api/types";
import { useResource } from "@/lib/api/use-resource";
import { cn } from "@/lib/cn";
import { presetWidth, type PreviewDevice } from "@/lib/preview/render";

/** The sandbox sleeps after 10 idle minutes; asking for the URL also keeps it warm. */
const KEEP_ALIVE_MS = 4 * 60 * 1000;

type Props = {
  projectId: string;
  device: PreviewDevice;
  preset: string;
  /** Bumping this refetches the URL, which is what Reload has to mean now. */
  nonce?: number;
  onPreview?: (info: PreviewInfo) => void;
  className?: string;
};

/**
 * The built app, running in its own cloud sandbox.
 *
 * No `sandbox` attribute: that was right when the preview was user HTML injected
 * into *our* origin, and is wrong for a real app on its own origin that needs
 * storage, HMR and a Supabase client. The isolation now comes from the origin.
 */
export function PreviewSurface({ projectId, device, preset, nonce = 0, onPreview, className }: Props) {
  const [attempt, setAttempt] = useState(0);
  const preview = useResource(key.preview(projectId), () => getPreview(projectId));
  const { refresh } = preview;

  // Re-ask periodically while visible, both to keep the sandbox alive and to
  // notice when it has been replaced.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!document.hidden) refresh();
    }, KEEP_ALIVE_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (nonce > 0) refresh();
  }, [nonce, refresh]);

  const ready = preview.status === "ready" ? preview.data : null;
  const onPreviewRef = useRef(onPreview);
  useEffect(() => {
    onPreviewRef.current = onPreview;
  });
  useEffect(() => {
    if (ready) onPreviewRef.current?.(ready);
  }, [ready]);

  // A cold sandbox answers 503 for the 5-60 seconds it takes to boot, and the
  // guide's instruction is simply to call again.
  const starting = preview.status === "error" && preview.error.code === "sandbox_unavailable";
  const retry = useCallback(() => {
    setAttempt((n) => n + 1);
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!starting) return;
    const delay = Math.min(1000 * 2 ** attempt, 10_000);
    const id = window.setTimeout(retry, delay);
    return () => window.clearTimeout(id);
  }, [starting, attempt, retry]);

  const width = presetWidth(device, preset);

  if (preview.status !== "ready") {
    return (
      <div className={cn("flex h-full w-full items-center justify-center px-6 text-center", className)}>
        <div className="flex flex-col items-center gap-2.5">
          <Spinner className="size-4" />
          <p className="text-sm text-muted">
            {starting || preview.status === "loading" ? "Starting your workspace…" : preview.error.message}
          </p>
          {preview.status === "error" && !starting && (
            <button
              type="button"
              onClick={retry}
              className="cursor-pointer text-[13px] font-semibold text-fg underline underline-offset-2"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <iframe
      key={`${ready?.url}-${nonce}`}
      title="App preview"
      src={ready?.url}
      className={cn("h-full w-full border-0 bg-white transition-[max-width] duration-300 ease-soft", className)}
      style={width ? { maxWidth: width } : undefined}
    />
  );
}
