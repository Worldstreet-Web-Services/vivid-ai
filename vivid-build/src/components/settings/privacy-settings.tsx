"use client";

import { useState } from "react";
import { ConnectorLogo } from "@/components/brand/connector-logo";
import { Skeleton } from "@/components/ui/skeleton";
import { Toggle } from "@/components/ui/toggle";
import { useToast } from "@/components/ui/toast";
import { useSession } from "@/lib/api/session";
import { buttonClass } from "@/lib/ui";
import { PageHeader } from "./page-header";
import { RowValue, SettingRow, SettingRows } from "./setting-row";
import { SettingsSection } from "./settings-section";
import { displayEmail } from "@/lib/api/user";

export function PrivacySettings() {
  const { user, signOut } = useSession();
  const { toast } = useToast();
  const [telemetry, setTelemetry] = useState(false);

  if (!user) {
    return (
      <SettingsSection title="Privacy & security">
        <Skeleton className="h-32" />
      </SettingsSection>
    );
  }

  return (
    <>
      <PageHeader title="Privacy & security" description="Protect access to your account and your data." />

      <SettingsSection title="Linked accounts" description="Accounts linked for sign-in.">
        <SettingRows>
          <SettingRow
            label={
              <>
                <ConnectorLogo id="google" name="Google" className="size-6" />
                Google
                <span className="rounded-md bg-tint px-1.5 py-0.5 text-[10px] font-bold text-fg-2">Primary</span>
              </>
            }
            description={displayEmail(user) ?? "Not set"}
            action={<RowValue>Connected</RowValue>}
          />
          <SettingRow
            label="Link company account"
            description="Use your organisation's single sign-on."
            action={
              <button
                type="button"
                onClick={() => toast("SSO needs a real identity provider")}
                className={buttonClass({ variant: "secondary", size: "sm" })}
              >
                Link account
              </button>
            }
          />
        </SettingRows>
      </SettingsSection>

      <SettingsSection title="Security">
        <SettingRows>
          <SettingRow
            label="Two-factor authentication"
            description="Re-authenticate before changing two-factor settings."
            action={
              <button
                type="button"
                onClick={() => toast("No auth backend to re-authenticate against")}
                className={buttonClass({ variant: "secondary", size: "sm" })}
              >
                Reauthenticate
              </button>
            }
          />
          <SettingRow
            label="Sign out"
            description="Ends the session in this browser. Revoking your other devices needs an endpoint the API does not expose."
            action={
              <button type="button" onClick={signOut} className={buttonClass({ variant: "secondary", size: "sm" })}>
                Sign out
              </button>
            }
          />
        </SettingRows>
      </SettingsSection>

      <SettingsSection title="Data" description="Your projects live on the server; only view preferences stay here.">
        <SettingRows>
          <SettingRow
            label="Product analytics"
            description="Nothing is collected in this prototype — the toggle is here to show where it would live."
            action={<Toggle checked={telemetry} onChange={setTelemetry} label="Product analytics" />}
          />
          <SettingRow
            label="Export your data"
            description="There is no export endpoint yet. Each project's files can be read from its Code tab."
            action={<RowValue>Not available</RowValue>}
          />
          <SettingRow
            label="Delete your account"
            description="The API has no endpoint to close an account, so this has to be done by support."
            action={<RowValue>Not available</RowValue>}
          />
        </SettingRows>
      </SettingsSection>
    </>
  );
}
