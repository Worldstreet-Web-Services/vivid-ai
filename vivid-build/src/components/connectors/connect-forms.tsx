"use client";

import { useState, type ReactNode } from "react";
import { useToast } from "@/components/ui/toast";
import { addConnector, removeConnector, supabaseAuthorizeUrl } from "@/lib/api/endpoints";
import { ApiError, type Connector } from "@/lib/api/types";
import { inputClass } from "@/components/settings/field";
import { buttonClass } from "@/lib/ui";

/**
 * The three connect forms, in one place.
 *
 * Both the account-wide dialog and the project settings page need them, and a
 * credential form is exactly the thing that must not exist in two versions —
 * the `type="password"` and `autoComplete="off"` below are the whole reason.
 */

function useConnect(onDone: () => void) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await action();
      toast(done);
      onDone();
    } catch (error) {
      // 422 carries the provider's own reason ("this key has no Places access").
      // That is far more useful than anything we could write here.
      toast(error instanceof Error ? error.message : "Could not connect", "warn");
    } finally {
      setBusy(false);
    }
  };

  return { busy, run };
}

function Secret(props: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <input
      value={props.value}
      onChange={(event) => props.onChange(event.target.value)}
      placeholder={props.placeholder}
      // A credential: never a saved form value, never autofilled.
      type="password"
      autoComplete="off"
      spellCheck={false}
      className={inputClass}
    />
  );
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-[1.5] text-muted-3">{children}</p>;
}

export function ConnectSupabase({ onDone }: { onDone: () => void }) {
  const { toast } = useToast();
  const { busy, run } = useConnect(onDone);
  const [token, setToken] = useState("");
  const [redirecting, setRedirecting] = useState(false);

  /**
   * The hosted OAuth app may not be set up (this deployment answers
   * `supabase_oauth: false` on /health), in which case §9's fallback is a pasted
   * personal access token. The backend's own 503 message says exactly that, so
   * show it rather than inventing our own wording.
   */
  const authorize = async () => {
    setRedirecting(true);
    try {
      const { url } = await supabaseAuthorizeUrl();
      window.location.href = url;
    } catch (error) {
      toast(
        error instanceof ApiError
          ? error.message
          : "Connecting with a button is not available. Paste a token instead.",
        "warn",
      );
      setRedirecting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        disabled={busy || redirecting}
        onClick={() => void authorize()}
        className={buttonClass({ size: "sm", className: "self-start disabled:opacity-50" })}
      >
        Connect Supabase
      </button>
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="min-w-0 flex-1">
          <Secret value={token} onChange={setToken} placeholder="…or paste a personal access token (sbp_…)" />
        </div>
        <button
          type="button"
          disabled={busy || !token.trim()}
          onClick={() =>
            void run(() => addConnector({ provider: "supabase", token: token.trim() }), "Supabase connected").then(
              () => setToken(""),
            )
          }
          className={buttonClass({
            variant: "secondary",
            size: "sm",
            className: "disabled:cursor-not-allowed disabled:opacity-50",
          })}
        >
          Save
        </button>
      </div>
      <Hint>Create one under Account → Access Tokens in the Supabase dashboard.</Hint>
    </div>
  );
}

export function ConnectPaystack({ onDone }: { onDone: () => void }) {
  const { busy, run } = useConnect(onDone);
  const [secret, setSecret] = useState("");
  const [publicKey, setPublicKey] = useState("");

  return (
    <div className="flex flex-col gap-2.5">
      <input
        value={publicKey}
        onChange={(event) => setPublicKey(event.target.value)}
        placeholder="Public key (pk_test_… or pk_live_…)"
        autoComplete="off"
        spellCheck={false}
        className={inputClass}
      />
      <Secret value={secret} onChange={setSecret} placeholder="Secret key (sk_test_… or sk_live_…)" />
      <Hint>
        Both keys must be test or both live. The secret is verified and stored encrypted; it is never sent back here.
      </Hint>
      <button
        type="button"
        disabled={busy || !secret.trim() || !publicKey.trim()}
        onClick={() =>
          void run(
            () => addConnector({ provider: "paystack", token: secret.trim(), public_key: publicKey.trim() }),
            "Paystack connected",
          ).then(() => {
            setSecret("");
            setPublicKey("");
          })
        }
        className={buttonClass({
          size: "sm",
          className: "self-start disabled:cursor-not-allowed disabled:opacity-50",
        })}
      >
        Connect Paystack
      </button>
    </div>
  );
}

export function ConnectGoogleMaps({ onDone }: { onDone: () => void }) {
  const { busy, run } = useConnect(onDone);
  const [token, setToken] = useState("");

  return (
    <div className="flex flex-col gap-2.5">
      <Secret value={token} onChange={setToken} placeholder="Browser key (AIza…)" />
      <Hint>
        Needs Maps JavaScript, Places and Geocoding enabled. It is verified by geocoding one address. A browser key is
        public once the app ships, so restrict it to your site&rsquo;s domain in Google Cloud.
      </Hint>
      <button
        type="button"
        disabled={busy || !token.trim()}
        onClick={() =>
          void run(() => addConnector({ provider: "google_maps", token: token.trim() }), "Google Maps connected").then(
            () => setToken(""),
          )
        }
        className={buttonClass({
          size: "sm",
          className: "self-start disabled:cursor-not-allowed disabled:opacity-50",
        })}
      >
        Connect Google Maps
      </button>
    </div>
  );
}

export function ConnectForm({ provider, onDone }: { provider: string; onDone: () => void }) {
  if (provider === "supabase") return <ConnectSupabase onDone={onDone} />;
  if (provider === "paystack") return <ConnectPaystack onDone={onDone} />;
  if (provider === "google_maps") return <ConnectGoogleMaps onDone={onDone} />;
  return null;
}

export function DisconnectButton({ connector, onDone }: { connector: Connector; onDone: () => void }) {
  const { busy, run } = useConnect(onDone);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void run(() => removeConnector(connector.id), `${connector.name} disconnected`)}
      className={buttonClass({ variant: "secondary", size: "sm", className: "disabled:opacity-50" })}
    >
      Disconnect
    </button>
  );
}
