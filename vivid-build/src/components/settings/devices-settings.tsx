"use client";

import { ConnectorLogo } from "@/components/brand/connector-logo";
import { useToast } from "@/components/ui/toast";
import { buttonClass } from "@/lib/ui";
import { PageHeader } from "./page-header";
import { SettingRow, SettingRows } from "./setting-row";
import { SettingsSection } from "./settings-section";

const MESSAGING = [
  {
    id: "telegram",
    name: "Telegram",
    body: "Link Telegram to chat with VividBuild about your projects via DMs.",
    cta: "Connect to Telegram",
  },
  {
    id: "slack",
    name: "Slack",
    body: "Connect a Slack workspace so your team can build by tagging @vividbuild in any channel.",
    cta: "Set up",
  },
] as const;

export function DevicesSettings() {
  const { toast } = useToast();

  return (
    <>
      <PageHeader title="Devices and apps" description="Use VividBuild on your desktop, phone, and messaging apps." />

      <SettingsSection
        title="Messaging"
        description="Chat with VividBuild about projects in this workspace without leaving your chat app."
      >
        <SettingRows>
          {MESSAGING.map((app) => (
            <SettingRow
              key={app.id}
              label={
                <>
                  <ConnectorLogo id={app.id} name={app.name} className="size-6" />
                  {app.name}
                  <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold text-muted-2">
                    Not connected
                  </span>
                </>
              }
              description={app.body}
              action={
                <button
                  type="button"
                  onClick={() => toast(`${app.name} needs a real backend to connect`)}
                  className={buttonClass({ variant: "secondary", size: "sm" })}
                >
                  {app.cta}
                </button>
              }
            />
          ))}
        </SettingRows>
      </SettingsSection>

      <SettingsSection title="On your desktop" description="Fast, light, with local MCP support.">
        <div className="rounded-xl border border-line-2 bg-[linear-gradient(160deg,var(--surface2),var(--bg))] p-6">
          <p className="text-lg font-extrabold tracking-[-0.03em]">VividBuild for macOS</p>
          <p className="mt-1.5 max-w-[380px] text-[13px] leading-[1.55] text-muted">
            Organise your projects with tabs and use local MCP servers in your workflows.
          </p>
          <button
            type="button"
            onClick={() => toast("No desktop build exists yet")}
            className={buttonClass({ size: "sm", className: "mt-4" })}
          >
            Download for macOS
          </button>
        </div>
      </SettingsSection>

      <SettingsSection title="Browser" description="Where this workspace is currently open.">
        <SettingRow
          label="This browser"
          description="Projects are stored here, so they follow the device rather than the account."
          action={<span className="rounded-full bg-tint px-2.5 py-1 text-[11px] font-bold text-fg">Active</span>}
        />
      </SettingsSection>
    </>
  );
}
