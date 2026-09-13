"use client";

import { BookmarkPlus, RotateCcw, Undo2 } from "lucide-react";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { key, listSnapshots, restoreSnapshot, takeSnapshot, undo } from "@/lib/api/endpoints";
import type { Snapshot } from "@/lib/api/types";
import { useResource } from "@/lib/api/use-resource";
import { buttonClass } from "@/lib/ui";

const timeFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

/**
 * Versions.
 *
 * Every changing turn stores one server-side, so unlike the old local history
 * this is simply a list — there is no reconstructing files in the browser. A
 * restore hands the live sandbox the old files, so the preview has to be
 * reloaded afterwards.
 */
export function VersionList({ projectId, onRestored }: { projectId: string; onRestored: () => void }) {
  const { toast } = useToast();
  const snapshots = useResource(key.snapshots(projectId), () => listSnapshots(projectId));
  const [confirming, setConfirming] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await action();
      toast(done);
      onRestored();
    } catch (error) {
      toast(error instanceof Error ? error.message : "That did not work", "warn");
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  };

  if (snapshots.status === "loading") return <Skeleton className="h-40 rounded-2xl" />;

  if (snapshots.status === "error") {
    return (
      <p className="rounded-2xl border border-dashed border-line-2 p-6 text-center text-sm text-muted">
        {snapshots.error.message}
      </p>
    );
  }

  if (!snapshots.data.length) {
    return (
      <div className="rounded-2xl border border-dashed border-line-2 px-6 py-12 text-center">
        <p className="text-sm font-semibold text-fg">No versions yet</p>
        <p className="mt-1.5 text-sm text-muted">Every turn that changes a file is saved here.</p>
      </div>
    );
  }

  const newest = snapshots.data[0];

  return (
    <>
      <div className="mb-3 flex flex-wrap justify-end gap-2.5">
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(() => takeSnapshot(projectId), "Version saved")}
          className={buttonClass({
            variant: "secondary",
            size: "sm",
            className: "disabled:cursor-not-allowed disabled:opacity-50",
          })}
        >
          <BookmarkPlus aria-hidden className="mr-1.5 inline size-3.5 align-[-3px]" />
          Save a version
        </button>
        <button
          type="button"
          disabled={busy || snapshots.data.length < 2}
          onClick={() => void run(() => undo(projectId), "Undone")}
          className={buttonClass({
            variant: "secondary",
            size: "sm",
            className: "disabled:cursor-not-allowed disabled:opacity-50",
          })}
        >
          <Undo2 aria-hidden className="mr-1.5 inline size-3.5 align-[-3px]" />
          Undo last change
        </button>
      </div>

      <ul className="flex flex-col gap-2.5">
        {snapshots.data.map((snapshot) => {
          const current = snapshot.id === newest.id;
          return (
            <li key={snapshot.id} className="rounded-2xl border border-line-2 bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="min-w-0 flex-1 text-sm font-bold text-fg">
                  <span className="text-muted-3">v{snapshot.seq}</span>{" "}
                  {snapshot.summary?.split("\n")[0] ?? "Saved version"}
                </p>
                {current ? (
                  <span className="rounded-full bg-tint px-2.5 py-1 text-[11px] font-bold text-fg">Current</span>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirming(snapshot)}
                    className="flex flex-none cursor-pointer items-center gap-1.5 rounded-lg border border-line-2 px-2.5 py-1.5 text-[12px] font-semibold text-fg-2 transition-colors hover:border-line-3 hover:text-fg disabled:opacity-50"
                  >
                    <RotateCcw aria-hidden className="size-3.5" />
                    Restore
                  </button>
                )}
              </div>
              <p className="mt-1.5 text-xs text-muted">{timeFormat.format(Date.parse(snapshot.created_at))}</p>
            </li>
          );
        })}
      </ul>

      {confirming && (
        <Dialog
          title={`Restore v${confirming.seq}?`}
          description="The files go back to how they were. Nothing is lost — the next turn continues the sequence."
          size="sm"
          onClose={() => setConfirming(null)}
        >
          <div className="flex justify-end gap-2.5 px-5 py-4">
            <button
              type="button"
              onClick={() => setConfirming(null)}
              className={buttonClass({ variant: "secondary", size: "sm" })}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => restoreSnapshot(projectId, confirming.seq), `Restored v${confirming.seq}`)}
              className={buttonClass({ size: "sm" })}
            >
              Restore
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
