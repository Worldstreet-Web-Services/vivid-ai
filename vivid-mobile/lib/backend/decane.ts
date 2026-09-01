// Emailed sign-in codes through Decane Connect, identity only.
//
// Decane delivers the code and issues the access token. It is not a separate
// identity a user chooses: Vivid has one account, and this is how someone
// proves they own the address on it. There are no third-party provider
// buttons, so nothing here opens an auth sheet.
//
// The Decane SDKs are embedded-WALLET kits: they go on to create a crypto
// wallet and demand a passkey or PIN to encrypt the wallet's key share. Vivid
// needs none of that, and Decane issues the token before any wallet step, so
// this calls the two relevant endpoints directly and never loads an SDK. Same
// flow as the web app.
//
// Flow: POST /auth/email/start sends the code, POST /auth/email/verify
// exchanges it for the access token our backend verifies.

import { DECANE_API_BASE, DECANE_API_KEY, DECANE_APP_ID } from "@/config/env";
import { NETWORK_ERROR_MESSAGE, type DecaneProfile } from "@/lib/backend/client";

export const decaneConfigured = Boolean(DECANE_APP_ID && DECANE_API_KEY);

async function decanePost<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${DECANE_API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": DECANE_API_KEY,
        "X-App-Id": DECANE_APP_ID,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(NETWORK_ERROR_MESSAGE);
  }
  if (!res.ok) {
    let detail = `That did not work (${res.status})`;
    try {
      const parsed = (await res.json()) as { error?: { message?: string } };
      if (parsed.error?.message) detail = parsed.error.message;
    } catch {
      // keep the status message
    }
    throw new Error(detail);
  }
  return (res.status === 204 ? null : await res.json()) as T;
}

// Step one of the emailed-code sign-in: Decane sends a six-digit code.
export async function startEmailSignIn(email: string): Promise<void> {
  await decanePost("/auth/email/start", { email });
}

interface EmailVerifyResponse {
  jwt: string;
  isNewUser?: boolean;
  profile?: { name?: string | null; email?: string | null; picture?: string | null };
}

// Step two: the code buys the Decane access token our backend verifies to
// open a Vivid session.
export async function verifyEmailCode(
  email: string,
  code: string
): Promise<{ jwt: string; profile: DecaneProfile }> {
  const result = await decanePost<EmailVerifyResponse>("/auth/email/verify", { email, code });
  if (!result?.jwt) throw new Error("That code did not work. Ask for a new one.");
  return {
    jwt: result.jwt,
    profile: {
      name: result.profile?.name ?? null,
      // Decane does not echo the address back, and it is the one thing we
      // know for certain here: the code only reaches the inbox that owns it.
      email: result.profile?.email ?? email,
      picture: result.profile?.picture ?? null,
    },
  };
}
