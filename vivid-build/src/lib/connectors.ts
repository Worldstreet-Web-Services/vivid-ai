/**
 * The connectors VividBuild supports.
 *
 * This used to be a catalogue of twenty-nine — Stripe, Okta, Clerk, Notion and
 * the rest — left over from the prototype, when nothing behind it was real.
 * The builder API implements exactly three, so those are the three listed here.
 * Anything else is something to ask the agent to write by hand, not a toggle.
 *
 * A connection belongs to the account; attaching it to a project is a second,
 * separate step (§9), which is why each entry carries both stories.
 */

import type { ConnectorProvider } from "@/lib/api/types";

export type ConnectorSpec = {
  provider: ConnectorProvider;
  name: string;
  /** Matches `ConnectorLogo`'s brand ids. */
  logo: string;
  category: string;
  /** What connecting it buys the user. */
  body: string;
  /** What the agent gains once a project is attached to it. */
  unlocks: string;
};

export const CONNECTORS: readonly ConnectorSpec[] = [
  {
    provider: "supabase",
    name: "Supabase",
    logo: "supabase",
    category: "Data & auth",
    body: "A Postgres database with accounts, row-level policies and file storage.",
    unlocks: "The agent can write migrations, deploy edge functions and store secrets.",
  },
  {
    provider: "paystack",
    name: "Paystack",
    logo: "paystack",
    category: "Payments",
    body: "Card and transfer payments across Africa, in local currency.",
    unlocks: "With a Supabase backend the agent builds a verified checkout and a signed webhook.",
  },
  {
    provider: "google_maps",
    name: "Google Maps",
    logo: "google-maps",
    category: "Location",
    body: "Address autocomplete, maps on tracking pages and distance-based fees.",
    unlocks: "The key lands in the app as VITE_GOOGLE_MAPS_KEY and the maps skill rides with every turn.",
  },
];

export function connectorSpec(provider: string): ConnectorSpec | undefined {
  return CONNECTORS.find((connector) => connector.provider === provider);
}
