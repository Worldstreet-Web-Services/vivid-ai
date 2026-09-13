import "server-only";

/**
 * Server-side configuration.
 *
 * None of these are `NEXT_PUBLIC_`: the browser never talks to the Vivid API
 * directly (its CORS allowlist rejects this origin), and `DECANE_API_KEY` is a
 * secret. Everything reaches the backend through the relay in
 * `src/app/api/vivid/[...path]/route.ts`.
 */

/** Throws at call time rather than import time, so a missing value names itself. */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Copy .env.local.example to .env.local and fill it in.`);
  }
  return value;
}

/** No trailing slash, so callers can always join with a leading one. */
export function vividApiBase(): string {
  return required("VIVID_API_BASE").replace(/\/+$/, "");
}

export function decaneConfig() {
  return {
    appId: required("DECANE_APP_ID"),
    apiKey: required("DECANE_API_KEY"),
    verificationKey: process.env.DECANE_VERIFICATION_KEY,
  };
}
