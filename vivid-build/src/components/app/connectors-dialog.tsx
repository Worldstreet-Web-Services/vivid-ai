"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ConnectorLogo } from "@/components/brand/connector-logo";
import { ConnectForm, DisconnectButton } from "@/components/connectors/connect-forms";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { key, listConnectors } from "@/lib/api/endpoints";
import { useProjects } from "@/lib/api/hooks";
import { useResource } from "@/lib/api/use-resource";
import { CONNECTORS } from "@/lib/connectors";
import { connectorsHref } from "./data";

/**
 * The account's connections.
 *
 * A connection belongs to the account and serves every project, so connecting
 * and disconnecting happen here; choosing which project *uses* one is a
 * separate step in that project's settings, linked at the bottom.
 *
 * This used to browse a catalogue of twenty-nine connectors that did not exist.
 * Showing three real ones you can actually connect is worth more than showing
 * twenty-nine you cannot.
 */
export function ConnectorsDialog({ onClose }: { onClose: () => void }) {
  const connectors = useResource(key.connectors, () => listConnectors());
  const projects = useProjects();
  const newestProject = projects.status === "ready" ? projects.data[0] : undefined;
  const [opened, setOpened] = useState<string | null>(null);

  const connected = connectors.status === "ready" ? connectors.data : [];

  return (
    <Dialog
      title="Connectors"
      description="Connect an account once and any project can use it. Ask the agent for anything else and it writes the integration by hand."
      size="lg"
      onClose={onClose}
    >
      <div className="flex flex-col gap-2.5 px-5 py-4">
        {connectors.status === "loading" && <Skeleton className="h-56" />}

        {connectors.status === "error" && (
          <div className="rounded-xl border border-line-2 bg-surface-2 p-4">
            <p className="text-sm text-fg-2">{connectors.error.message}</p>
            <button
              type="button"
              onClick={connectors.retry}
              className="mt-2 cursor-pointer text-xs font-semibold text-fg underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        )}

        {connectors.status === "ready" &&
          CONNECTORS.map((spec) => {
            const live = connected.find((item) => item.provider === spec.provider);
            const open = opened === spec.provider;

            return (
              <section key={spec.provider} className="rounded-xl border border-line-2 bg-surface-2 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <ConnectorLogo id={spec.logo} name={spec.name} className="size-9" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-bold text-fg">
                      {spec.name}
                      <span className="rounded-full bg-tint px-2 py-0.5 text-[10px] font-bold tracking-[0.04em] text-fg-2 uppercase">
                        {spec.category}
                      </span>
                    </p>
                    <p className="mt-1 text-xs leading-[1.5] text-muted">{spec.body}</p>
                  </div>

                  {live ? (
                    <div className="flex flex-none items-center gap-2.5">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-code-string">
                        <Check aria-hidden className="size-3.5" />
                        {live.name}
                      </span>
                      <DisconnectButton connector={live} onDone={connectors.refresh} />
                    </div>
                  ) : (
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setOpened(open ? null : spec.provider)}
                      className="flex-none cursor-pointer rounded-full border border-line-2 px-4 py-2 text-xs font-semibold text-fg transition-colors hover:border-line-3"
                    >
                      {open ? "Cancel" : "Connect"}
                    </button>
                  )}
                </div>

                {live ? (
                  <p className="mt-2.5 border-t border-line pt-2.5 text-xs leading-[1.5] text-muted-3">
                    {spec.unlocks}
                  </p>
                ) : (
                  open && (
                    <div className="mt-3.5 border-t border-line pt-3.5">
                      <ConnectForm
                        provider={spec.provider}
                        onDone={() => {
                          setOpened(null);
                          connectors.refresh();
                        }}
                      />
                    </div>
                  )
                )}
              </section>
            );
          })}
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-bg-2 px-5 py-3.5">
        <p className="text-xs text-muted">
          {connected.length} of {CONNECTORS.length} connected
        </p>
        {newestProject ? (
          <Link
            href={connectorsHref(newestProject.id)}
            onClick={onClose}
            className="text-xs font-semibold text-fg underline underline-offset-2"
          >
            Choose which projects use them
          </Link>
        ) : (
          <Link
            href="/dashboard"
            onClick={onClose}
            className="text-xs font-semibold text-fg underline underline-offset-2"
          >
            Build a project to use them
          </Link>
        )}
      </div>
    </Dialog>
  );
}
