"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { updateWorkspacePrefs, usePrefs } from "@/lib/store/prefs";
import type { Prefs } from "@/lib/store/types";
import { CheckboxField } from "./field";
import { SettingsSection } from "./settings-section";
import { ThemePicker } from "./theme-picker";

const CODE_SIZES = [12, 12.5, 14] as const;

const DEVICES: { key: Prefs["workspace"]["device"]; label: string }[] = [
  { key: "desktop", label: "Desktop" },
  { key: "tablet", label: "Tablet" },
  { key: "phone", label: "Phone" },
];

export function AppearanceSettings() {
  const snapshot = usePrefs();
  const workspace = snapshot.status === "ready" ? snapshot.data.workspace : null;

  return (
    <>
      <SettingsSection title="Style" description="Applies immediately, and is remembered on this device.">
        <ThemePicker />
      </SettingsSection>

      <SettingsSection title="Workspace" description="Defaults for the project workspace.">
        {!workspace ? (
          <Skeleton className="h-10" />
        ) : (
          <>
            <p className="text-xs font-semibold text-muted-2">Preview opens at</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {DEVICES.map((device) => {
                const selected = workspace.device === device.key;
                return (
                  <button
                    key={device.key}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => updateWorkspacePrefs({ device: device.key })}
                    className={cn(
                      "cursor-pointer rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors",
                      selected
                        ? "border-transparent bg-btn text-btn-fg"
                        : "border-line-2 text-muted hover:border-line-3 hover:text-fg",
                    )}
                  >
                    {device.label}
                  </button>
                );
              })}
            </div>

            <p className="mt-4 text-xs font-semibold text-muted-2">Code size</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {CODE_SIZES.map((size) => {
                const selected = workspace.codeFontSize === size;
                return (
                  <button
                    key={size}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => updateWorkspacePrefs({ codeFontSize: size })}
                    className={cn(
                      "cursor-pointer rounded-full border px-3.5 py-2 font-mono text-[13px] font-semibold transition-colors",
                      selected
                        ? "border-transparent bg-btn text-btn-fg"
                        : "border-line-2 text-muted hover:border-line-3 hover:text-fg",
                    )}
                  >
                    {size}px
                  </button>
                );
              })}
              <span
                className="ml-1 rounded-lg border border-line-2 bg-surface-2 px-3 py-1.5 font-mono text-muted-2"
                style={{ fontSize: `${workspace.codeFontSize}px` }}
              >
                const preview = true;
              </span>
            </div>

            <div className="mt-4">
              <CheckboxField
                checked={workspace.codeWrap}
                onChange={(codeWrap) => updateWorkspacePrefs({ codeWrap })}
              >
                Wrap long lines in the code viewer.
              </CheckboxField>
            </div>
          </>
        )}
      </SettingsSection>

      <SettingsSection title="Motion" description="Controlled by your operating system.">
        <p className="text-sm leading-[1.6] text-muted">
          VividBuild honours your system&rsquo;s reduce-motion setting. With it on, the build animation,
          transitions and the hero scene all stop — there is nothing to turn off here.
        </p>
      </SettingsSection>
    </>
  );
}
