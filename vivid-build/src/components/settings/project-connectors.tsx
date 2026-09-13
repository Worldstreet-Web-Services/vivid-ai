"use client";

import { useState } from "react";
import { ConnectorLogo } from "@/components/brand/connector-logo";
import { ConnectForm, DisconnectButton } from "@/components/connectors/connect-forms";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import {
  disableMaps,
  disablePayments,
  enableMaps,
  enablePayments,
  key,
  linkSupabase,
  listConnectors,
  unlinkSupabase,
  updateProject,
} from "@/lib/api/endpoints";
import type { Connector } from "@/lib/api/types";
import { useResource } from "@/lib/api/use-resource";
import { connectorSpec } from "@/lib/connectors";
import { buttonClass } from "@/lib/ui";
import { inputClass } from "./field";
import { NoProject } from "./no-project";
import { PageHeader } from "./page-header";
import { ProjectSwitcher } from "./project-switcher";
import { RowValue, SettingRow, SettingRows } from "./setting-row";
import { useSettingsProjectDoc } from "./settings-project";
import { SettingsSection } from "./settings-section";

/**
 * Supabase, Paystack and Google Maps — the three §9 implements.
 *
 * Two layers, because the API has two: a connection belongs to the account and
 * serves every project, and then each project opts in to using it. Connecting
 * can also be done here so nobody has to go hunting for the account dialog.
 */
export function ProjectConnectors() {
  const { doc, hydrated } = useSettingsProjectDoc();
  const { toast } = useToast();
  const connectors = useResource(key.connectors, () => listConnectors());
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>, done: string): Promise<void> => {
    setBusy(true);
    try {
      await action();
      toast(done);
    } catch (error) {
      toast(error instanceof Error ? error.message : "That did not work", "warn");
    } finally {
      setBusy(false);
    }
  };

  if (!hydrated) {
    return (
      <SettingsSection title="Connectors">
        <Skeleton className="h-32" />
      </SettingsSection>
    );
  }
  if (!doc) return <NoProject title="Connectors" />;

  const connected = connectors.status === "ready" ? connectors.data : [];
  const find = (provider: string) => connected.find((item) => item.provider === provider);
  const supabase = find("supabase");
  const paystack = find("paystack");
  const maps = find("google_maps");
  const loading = connectors.status === "loading";

  return (
    <>
      <PageHeader
        title="Connectors"
        description="Give this project a database, payments and maps."
        action={<ProjectSwitcher />}
      />

      <SettingsSection
        title="Full-stack app"
        description="Accounts, sign-in and per-user records. Plan mode sets this from what you asked for; change it here if it guessed wrong."
      >
        <SettingRows>
          <SettingRow
            label={doc.fullstack ? "On" : "Off"}
            description={
              doc.fullstack
                ? doc.supabase_project_ref
                  ? "Accounts and data are real — the agent has migrations, policies and edge functions."
                  : "Link a Supabase project below, or the build keeps state in the browser only."
                : "A site: pages, catalogue, forms, cart and an owner area behind a PIN, all in the browser."
            }
            action={
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => updateProject(doc.id, { fullstack: !doc.fullstack }),
                    doc.fullstack ? "Full-stack off" : "Full-stack on",
                  )
                }
                className={buttonClass({ variant: "secondary", size: "sm", className: "disabled:opacity-50" })}
              >
                {doc.fullstack ? "Turn off" : "Turn on"}
              </button>
            }
          />
        </SettingRows>
      </SettingsSection>

      <Section provider="supabase" connector={supabase} loading={loading} onDone={connectors.refresh}>
        <SettingRows>
          <SettingRow
            label="This project"
            description={
              doc.supabase_project_ref
                ? `Using ${doc.supabase_project_ref}. The agent has database tools.`
                : "Pick which Supabase project this app should use."
            }
            action={
              doc.supabase_project_ref ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(() => unlinkSupabase(doc.id), "Unlinked")}
                  className={buttonClass({ variant: "secondary", size: "sm", className: "disabled:opacity-50" })}
                >
                  Unlink
                </button>
              ) : (
                <RowValue>Not linked</RowValue>
              )
            }
          />
          {!doc.supabase_project_ref && supabase?.projects && supabase.projects.length > 0 && (
            <SettingRow
              label="Available projects"
              action={
                <div className="flex flex-wrap justify-end gap-2">
                  {supabase.projects.map((item) => (
                    <button
                      key={item.ref}
                      type="button"
                      disabled={busy}
                      onClick={() => void run(() => linkSupabase(doc.id, { project_ref: item.ref }), "Linked")}
                      className={buttonClass({ variant: "secondary", size: "sm", className: "disabled:opacity-50" })}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              }
            />
          )}
        </SettingRows>
        {!doc.supabase_project_ref && !supabase && <PasteSupabaseKeys projectId={doc.id} />}
      </Section>

      <Section provider="paystack" connector={paystack} loading={loading} onDone={connectors.refresh}>
        <SettingRows>
          <SettingRow
            label="Payments on this project"
            description={
              doc.payments_provider === "paystack"
                ? "Remember to add the webhook URL from the agent's final message to your Paystack dashboard."
                : "Turn this on and the agent will wire checkout."
            }
            action={
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => (doc.payments_provider === "paystack" ? disablePayments(doc.id) : enablePayments(doc.id)),
                    doc.payments_provider === "paystack" ? "Payments off" : "Payments on",
                  )
                }
                className={buttonClass({ variant: "secondary", size: "sm", className: "disabled:opacity-50" })}
              >
                {doc.payments_provider === "paystack" ? "Turn off" : "Turn on"}
              </button>
            }
          />
        </SettingRows>
      </Section>

      <Section provider="google_maps" connector={maps} loading={loading} onDone={connectors.refresh}>
        <SettingRows>
          <SettingRow
            label="Maps on this project"
            description={
              doc.maps_provider === "google"
                ? "The app gets VITE_GOOGLE_MAPS_KEY and the maps skill rides with every turn."
                : "Turn this on for address autocomplete, maps and distance-based fees."
            }
            action={
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => (doc.maps_provider === "google" ? disableMaps(doc.id) : enableMaps(doc.id)),
                    doc.maps_provider === "google" ? "Maps off" : "Maps on",
                  )
                }
                className={buttonClass({ variant: "secondary", size: "sm", className: "disabled:opacity-50" })}
              >
                {doc.maps_provider === "google" ? "Turn off" : "Turn on"}
              </button>
            }
          />
        </SettingRows>
      </Section>
    </>
  );
}

/** One provider: the account connection on top, then what this project does with it. */
function Section({
  provider,
  connector,
  loading,
  onDone,
  children,
}: {
  provider: string;
  connector: Connector | undefined;
  loading: boolean;
  onDone: () => void;
  children: React.ReactNode;
}) {
  const spec = connectorSpec(provider);
  if (!spec) return null;

  return (
    <SettingsSection title={spec.name} description={`${spec.body} ${spec.unlocks}`}>
      {loading ? (
        <Skeleton className="h-16" />
      ) : connector ? (
        <>
          <SettingRows>
            <SettingRow
              label="Account"
              description={connector.name}
              action={
                <div className="flex items-center gap-2.5">
                  <ConnectorLogo id={spec.logo} name={spec.name} className="size-6" />
                  <DisconnectButton connector={connector} onDone={onDone} />
                </div>
              }
            />
          </SettingRows>
          <div className="mt-2.5">{children}</div>
        </>
      ) : (
        <ConnectForm provider={provider} onDone={onDone} />
      )}
    </SettingsSection>
  );
}

/**
 * §9's second and third Supabase shapes: keys only, or keys plus the pooler
 * connection string. Neither needs an account connection, which matters on a
 * deployment where the OAuth button is off and the user has no personal access
 * token — without this they simply cannot have a database.
 */
function PasteSupabaseKeys({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [ref, setRef] = useState("");
  const [anonKey, setAnonKey] = useState("");
  const [databaseUrl, setDatabaseUrl] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 cursor-pointer text-xs font-semibold text-fg underline underline-offset-2"
      >
        …or paste this project&rsquo;s keys instead
      </button>
    );
  }

  const save = async () => {
    setBusy(true);
    try {
      await linkSupabase(projectId, {
        project_ref: ref.trim(),
        anon_key: anonKey.trim(),
        ...(databaseUrl.trim() ? { database_url: databaseUrl.trim() } : {}),
      });
      toast("Supabase linked");
      setOpen(false);
    } catch (error) {
      // A bad connection string answers 400 with Postgres' own reason.
      toast(error instanceof Error ? error.message : "Could not link", "warn");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 flex flex-col gap-2.5 rounded-xl border border-line-2 bg-surface-2 p-3.5">
      <input
        value={ref}
        onChange={(event) => setRef(event.target.value)}
        placeholder="Project ref (the subdomain in your Supabase URL)"
        autoComplete="off"
        spellCheck={false}
        className={inputClass}
      />
      <input
        value={anonKey}
        onChange={(event) => setAnonKey(event.target.value)}
        placeholder="Anon key"
        autoComplete="off"
        spellCheck={false}
        className={inputClass}
      />
      <input
        value={databaseUrl}
        onChange={(event) => setDatabaseUrl(event.target.value)}
        placeholder="Session pooler URI (optional)"
        type="password"
        autoComplete="off"
        spellCheck={false}
        className={inputClass}
      />
      <p className="text-xs leading-[1.5] text-muted-3">
        Keys alone go into the app&rsquo;s environment. Add the pooler URI from the dashboard&rsquo;s Connect panel and
        the builder applies migrations itself, so accounts and the admin area work without an account link.
      </p>
      <div className="flex gap-2.5">
        <button
          type="button"
          disabled={busy || !ref.trim() || !anonKey.trim()}
          onClick={() => void save()}
          className={buttonClass({
            size: "sm",
            className: "disabled:cursor-not-allowed disabled:opacity-50",
          })}
        >
          Link
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={buttonClass({ variant: "secondary", size: "sm" })}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
