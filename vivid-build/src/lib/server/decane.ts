import "server-only";

import { DecaneApiError, DecaneClient, type DecaneAuthResult } from "decane-node";
import { decaneConfig, vividApiBase } from "./env";

/**
 * Decane sign-in, server side.
 *
 * `decane-connect-kit` is a wallet connector and states plainly that social
 * sign-in is not included; `decane-node` is the package that has it. It needs
 * DECANE_API_KEY, which is a secret, so the whole flow lives here and the
 * browser only ever sees the resulting Vivid token pair.
 *
 * Email OTP is fully server-side. Google is not: decane-node cannot run
 * Google's redirect flow, so the browser obtains the Google ID token and posts
 * it here for the exchange.
 */

let client: DecaneClient | null = null;

function decane(): DecaneClient {
  if (!client) {
    const { appId, apiKey, verificationKey } = decaneConfig();
    client = new DecaneClient({ appId, apiKey, verificationKey });
  }
  return client;
}

export type VividUser = {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  profile_email: string | null;
  created_at: string;
};

export type VividTokens = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: VividUser;
};

/**
 * Trades a Decane access token for Vivid's own pair.
 *
 * The Decane token is never returned to the caller and never stored — it exists
 * only for the length of this function, which is what the integration guide asks
 * for. The profile fields are display-only; Vivid's token carries no email.
 */
async function exchange(result: DecaneAuthResult, fallbackEmail?: string): Promise<VividTokens> {
  return exchangeDecaneToken(result.accessToken, {
    name: result.profile?.name,
    email: result.profile?.email ?? fallbackEmail,
    picture: result.profile?.picture,
  });
}

/** The exchange itself, also reachable from the Google redirect, which arrives with a bare JWT. */
export async function exchangeDecaneToken(
  accessToken: string,
  profile: { name?: string; email?: string; picture?: string } = {},
): Promise<VividTokens> {
  const response = await fetch(`${vividApiBase()}/auth/decane`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ access_token: accessToken, ...profile }),
  });

  if (!response.ok) {
    const detail = await response.text();
    // Server-side only: the exchange failing is an integration problem (usually
    // the two sides pointing at different Decane projects), and the status plus
    // the backend's own message is what identifies it.
    console.error(`[auth] /auth/decane exchange failed: ${response.status} ${detail}`);
    throw new ExchangeError(response.status, detail);
  }
  return (await response.json()) as VividTokens;
}

export class ExchangeError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string,
  ) {
    super("The sign-in could not be exchanged for a session.");
  }
}

/** Emails a 6-digit code. Always resolves, known address or not — Decane is deliberately non-enumerating. */
export async function startEmailSignIn(email: string): Promise<void> {
  await decane().connectWithEmail(email);
}

export async function verifyEmailSignIn(email: string, code: string): Promise<VividTokens> {
  const result = await decane().verifyEmailCode(email, code);
  return exchange(result, email);
}

export async function googleSignIn(idToken: string): Promise<VividTokens> {
  const result = await decane().connectWithGoogleToken(idToken);
  return exchange(result);
}

/** Maps a Decane or exchange failure onto a status and a message safe to show. */
export function signInErrorResponse(error: unknown): Response {
  if (error instanceof ExchangeError) {
    // The builder already scrubs vendor names from its errors, so its message is
    // safe to show and is the only thing that says *why* the exchange failed.
    let detail = "";
    try {
      const parsed = JSON.parse(error.detail) as { error?: { message?: string }; detail?: string };
      detail = parsed.error?.message ?? parsed.detail ?? "";
    } catch {
      detail = error.detail.slice(0, 200);
    }
    return Response.json(
      {
        error: {
          code: "exchange_failed",
          message: detail
            ? `Signed in, but the builder refused the session: ${detail}`
            : `Signed in, but the builder refused the session (${error.status}).`,
        },
      },
      { status: error.status === 401 ? 401 : 502 },
    );
  }

  if (error instanceof DecaneApiError) {
    const message =
      error.code === "INVALID_CODE"
        ? "That code is wrong or has expired."
        : error.code === "RATE_LIMITED"
          ? "Too many attempts. Wait a few minutes and try again."
          : error.code === "AUTH_FAILED"
            ? "That sign-in was rejected."
            : "Sign-in is unavailable right now.";
    return Response.json({ error: { code: error.code, message } }, { status: error.status || 502 });
  }

  // A missing env var lands here. Name the fix rather than leaking the stack.
  const message = error instanceof Error ? error.message : "Sign-in failed.";
  return Response.json({ error: { code: "not_configured", message } }, { status: 503 });
}
