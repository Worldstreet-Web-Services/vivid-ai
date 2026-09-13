
/** Fallback identity, used before prefs hydrate and when storage is empty. */
export const DEFAULT_ACCOUNT = { firstName: "Korode", team: "Korode's team", initial: "K" } as const;

export const DASHBOARD_CHIPS = [
  "A storefront for a shoe brand",
  "Internal CRM",
  "A booking site for a salon",
] as const;

/**
 * Starter prompts. These used to select a local generator template; the backend
 * decides the architecture itself, so all that survives is the wording.
 */
export type ProjectTemplate = {
  name: string;
  body: string;
  prompt: string;
  /** Keyed into the composer's icon map. The panel used to be a near-black gradient. */
  icon: "store" | "portal" | "booking";
};

export const PROJECT_TEMPLATES: readonly ProjectTemplate[] = [
  {
    name: "Storefront",
    body: "Catalogue, cart, checkout",
    prompt: "A storefront with a product catalogue and checkout",
    icon: "store",
  },
  {
    name: "Client portal",
    body: "Auth, documents, billing",
    prompt: "A client portal with auth, documents and billing",
    icon: "portal",
  },
  {
    name: "Booking site",
    body: "Calendar, deposits, reminders",
    prompt: "A booking site with a calendar, deposits and reminders",
    icon: "booking",
  },
];

/**
 * Files merged into Code (tree on the left, viewer on the right) and the freed
 * slot became History. `parseTab` still resolves legacy `?tab=files` links.
 */
export const WORKSPACE_TABS = [
  { key: "preview", label: "Preview" },
  { key: "code", label: "Code" },
  { key: "history", label: "History" },
  { key: "more", label: "More" },
] as const;

export type WorkspaceTab = (typeof WORKSPACE_TABS)[number]["key"];

export function parseTab(value: string | null): WorkspaceTab {
  if (value === "files") return "code";
  return WORKSPACE_TABS.find((tab) => tab.key === value)?.key ?? "preview";
}

/** Connectors are attached per project from settings, not from a workspace tab. */
export const connectorsHref = (projectId: string) => `/settings/project/connectors?project=${projectId}`;
