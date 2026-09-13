import "server-only";

import { decaneConfig } from "./env";

const DECANE_API_BASE = process.env.DECANE_API_BASE ?? "https://backend.decane.app";

/**
 * Starts Decane's hosted Google flow.
 *
 * Decane owns the whole OAuth dance: this asks for the consent URL, the browser
 * goes there, Google bounces to Decane's callback, and Decane redirects back to
 * the callback URL registered against the API key in the Decane dashboard,
 * carrying `decane_jwt` and the profile as query parameters.
 *
 * So there is no Google client id in this app, and none in the SDK either — but
 * the API key is a secret, which is why this call has to happen server-side.
 */
export async function googleConsentUrl(): Promise<string> {
  const { appId, apiKey } = decaneConfig();
  const response = await fetch(`${DECANE_API_BASE}/auth/google/init`, {
    headers: { "X-API-Key": apiKey, "X-App-Id": appId },
  });

  const body = (await response.json().catch(() => ({}))) as {
    url?: string;
    error?: { code?: string; message?: string };
  };

  if (!response.ok || !body.url) {
    throw new Error(
      body.error?.message ??
        "Google sign-in is not set up for this Decane key. Add a callback URL in the Decane dashboard.",
    );
  }
  return body.url;
}
