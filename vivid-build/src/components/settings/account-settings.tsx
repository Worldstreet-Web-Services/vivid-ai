"use client";

import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { renameMe } from "@/lib/api/endpoints";
import { useSession } from "@/lib/api/session";
import type { User } from "@/lib/api/types";
import { buttonClass } from "@/lib/ui";
import { Field, FieldRow, inputClass } from "./field";
import { SettingsSection } from "./settings-section";
import { useDraft } from "./use-draft";
import { displayEmail } from "@/lib/api/user";

/** Best-effort, from the UA string. Only ever decorative. */
function describeBrowser() {
  if (typeof navigator === "undefined") return "Unknown browser";
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Safari\//.test(ua)
        ? "Safari"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : "Browser";
  const os = /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

function ProfileForm({ user, onSaved }: { user: User; onSaved: (message: string, tone?: "info" | "warn") => void }) {
  // The session holds the user it fetched at sign-in and has no way to be told
  // about a rename, so the saved name is tracked here — otherwise the form
  // would still read "Unsaved changes" straight after a successful save.
  const [savedName, setSavedName] = useState(user.name ?? "");
  const initial = useMemo(() => ({ name: savedName }), [savedName]);
  const { values, set, dirty, reset } = useDraft(initial);

  const save = async () => {
    const name = values.name.trim() || savedName;
    try {
      const updated = await renameMe(name);
      setSavedName(updated.name ?? name);
      set("name", updated.name ?? name);
      onSaved("Profile updated");
    } catch (error) {
      onSaved(error instanceof Error ? error.message : "Could not save your name", "warn");
    }
  };

  const name = values.name || displayEmail(user) || "";

  return (
    <SettingsSection
      title="Profile"
      description="How you appear across VividBuild."
      note={dirty ? "Unsaved changes" : "Your name is the only editable field on the account."}
      footer={
        <div className="flex gap-2">
          {dirty && (
            <button type="button" onClick={reset} className={buttonClass({ variant: "secondary", size: "sm" })}>
              Discard
            </button>
          )}
          <button
            type="button"
            onClick={() => void save()}
            disabled={!dirty}
            className={buttonClass({
              size: "sm",
              className: "disabled:cursor-not-allowed disabled:opacity-50",
            })}
          >
            Save
          </button>
        </div>
      }
    >
      <div className="flex items-center gap-4">
        {user.avatar_url ? (
          // The provider serves these from hosts that change per account, so
          // next/image's remotePatterns cannot cover them.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatar_url} alt="" className="size-12 flex-none rounded-xl object-cover" />
        ) : (
          <Avatar name={name} size="lg" />
        )}
        <p className="text-[13px] leading-[1.5] text-muted">
          Your picture comes from the account you signed in with. Changing it here needs an upload endpoint.
        </p>
      </div>

      {/* Cmd/Ctrl+S saves, which is what anyone editing a form like this reaches for. */}
      <FieldRow
        className="mt-4"
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
            event.preventDefault();
            if (dirty) void save();
          }
        }}
      >
        <Field label="Full name">
          {(id) => (
            <input
              id={id}
              value={values.name}
              onChange={(event) => set("name", event.target.value)}
              className={inputClass}
            />
          )}
        </Field>
        <Field label="Email" hint="Set when you signed in. The API has no endpoint to change it.">
          {(id) => <input id={id} type="email" disabled value={displayEmail(user) ?? ""} className={inputClass} />}
        </Field>
      </FieldRow>
    </SettingsSection>
  );
}

export function AccountSettings() {
  const { user, signOut } = useSession();
  const { toast } = useToast();

  // Matches the real section count so the page doesn't jump once the session lands.
  if (!user) {
    return (
      <>
        <SettingsSection title="Profile">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <Skeleton className="mt-4 h-10" />
          <Skeleton className="mt-3 h-10" />
        </SettingsSection>
        <SettingsSection title="Sessions">
          <Skeleton className="h-14 rounded-xl" />
        </SettingsSection>
      </>
    );
  }

  return (
    <>
      {/* Keyed on the saved name so the draft re-seeds after a save, rather than
          syncing state from an effect. */}
      <ProfileForm key={user.name ?? ""} user={user} onSaved={toast} />

      <SettingsSection
        title="Sessions"
        description="Where your account is signed in."
        note="The API lists no other sessions, so only this browser is shown."
      >
        <div className="flex items-center justify-between gap-4 rounded-xl border border-line-2 bg-surface-2 px-3.5 py-3">
          <div>
            <p className="text-sm font-semibold text-fg">This browser</p>
            <p className="mt-0.5 text-xs text-muted">{describeBrowser()} · active now</p>
          </div>
          <span className="flex-none rounded-full bg-tint px-2.5 py-1 text-[11px] font-bold text-fg">Current</span>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Sign out"
        description="Ends this browser's session."
        note="Your projects stay on the server and come back when you sign in again."
        footer={
          <button
            type="button"
            onClick={signOut}
            className={buttonClass({ variant: "secondary", size: "sm" })}
          >
            Sign out
          </button>
        }
      >
        <p className="text-sm leading-[1.6] text-muted">
          Signing out clears the tokens stored in this browser. Nothing is deleted, and there is no endpoint to
          close the account itself.
        </p>
      </SettingsSection>
    </>
  );
}
