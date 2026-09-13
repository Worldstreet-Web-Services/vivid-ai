"use client";

import { useState } from "react";
import { Toggle } from "@/components/ui/toggle";
import { useToast } from "@/components/ui/toast";
import { buttonClass } from "@/lib/ui";
import { PageHeader } from "./page-header";
import { RowValue, SettingRow, SettingRows } from "./setting-row";
import { SettingsSection } from "./settings-section";

const ENDPOINT = "https://mcp.vividbuild.dev/v1/sse";

const CONFIG = `{
  "mcpServers": {
    "vividbuild": {
      "url": "${ENDPOINT}",
      "headers": {
        "Authorization": "Bearer vb_live_••••••••"
      }
    }
  }
}`;

export function McpSettings() {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(false);

  return (
    <>
      <PageHeader
        title="MCP server"
        description="Let Claude, Cursor or any MCP client read and build your projects."
      />

      <SettingsSection title="Server">
        <SettingRows>
          <SettingRow
            label="Enable MCP server"
            description="Exposes your projects over the Model Context Protocol."
            action={<Toggle checked={enabled} onChange={setEnabled} label="Enable MCP server" />}
          />
          <SettingRow
            label="Endpoint"
            action={
              <div className="flex items-center gap-2">
                <code className="rounded-lg border border-line-2 bg-surface-2 px-2.5 py-1 font-mono text-xs text-fg-2">
                  {ENDPOINT}
                </code>
                <button
                  type="button"
                  onClick={() =>
                    navigator.clipboard?.writeText(ENDPOINT).then(
                      () => toast("Endpoint copied"),
                      () => toast("Could not copy", "warn"),
                    )
                  }
                  className={buttonClass({ variant: "secondary", size: "sm" })}
                >
                  Copy
                </button>
              </div>
            }
          />
          <SettingRow label="Transport" action={<RowValue>Server-sent events</RowValue>} />
          <SettingRow
            label="Authentication"
            description="Uses an API key with the Read projects scope."
            action={<RowValue>Bearer token</RowValue>}
          />
        </SettingRows>
      </SettingsSection>

      <SettingsSection
        title="Client configuration"
        description="Drop this into your MCP client's config file."
        footer={
          <button
            type="button"
            onClick={() =>
              navigator.clipboard?.writeText(CONFIG).then(
                () => toast("Config copied"),
                () => toast("Could not copy", "warn"),
              )
            }
            className={buttonClass({ variant: "secondary", size: "sm" })}
          >
            Copy config
          </button>
        }
        note={enabled ? "Server is enabled." : "Enable the server above before connecting a client."}
      >
        <pre className="overflow-x-auto rounded-xl border border-line-2 bg-surface-2 px-3.5 py-3 font-mono text-xs leading-[1.7] text-fg-2">
          <code>{CONFIG}</code>
        </pre>
      </SettingsSection>

      <SettingsSection title="Tools exposed" description="What a connected client can do.">
        <SettingRows>
          <SettingRow label="list_projects" description="Enumerate projects in this workspace." />
          <SettingRow label="read_project" description="Read a project's files, spec and history." />
          <SettingRow label="create_project" description="Start a build from a prompt." />
        </SettingRows>
      </SettingsSection>
    </>
  );
}
