/** Wire types for the Vivid Builder API, hand-written from the integration guide. */

export type User = {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  profile_email: string | null;
  created_at: string;
};

export type Tokens = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
};

export type ProjectMode = "plan" | "build";

export type Project = {
  id: string;
  name: string;
  mode: ProjectMode;
  /** Written by the prompt builder from the first message. */
  brief_md: string | null;
  spec_md: string | null;
  current_snapshot_id: string | null;
  backend_mode: "none" | "byo" | "cloud";
  supabase_project_ref: string | null;
  payments_provider: "none" | "paystack";
  maps_provider: "none" | "google";
  /** Accounts and server-side data were asked for. Plan mode sets it; settings can override. */
  fullstack: boolean;
  /** The design recipe the plan chose — "shop", "booking", "landing", … */
  recipe: string | null;
  published_url: string | null;
  created_at: string;
  updated_at: string;
};

export type PreviewInfo = { url: string; sandbox_id: string; driver: string };

export type Snapshot = {
  id: string;
  seq: number;
  commit_sha: string | null;
  /** The assistant's text for that turn — the version label. */
  summary: string | null;
  size_bytes: number;
  created_at: string;
};

export type PublishStatus = "pending" | "live" | "failed";

export type Publish = {
  id: string;
  snapshot_id: string;
  url: string | null;
  status: PublishStatus;
  /** The build log tail when status is "failed". */
  error: string | null;
  created_at: string;
  updated_at: string;
};

export type Asset = {
  id: string;
  name: string;
  mime: string;
  size_bytes: number;
  /** Where the built app serves it, e.g. "/uploads/logo.png". */
  path: string;
  /** Time-limited. Do not persist. */
  url: string;
  meta: { width: number; height: number } | null;
  created_at: string;
};

/** The three the backend actually implements, per §9. */
export type ConnectorProvider = "supabase" | "paystack" | "google_maps";

export type Connector = {
  id: string;
  provider: ConnectorProvider;
  name: string;
  mode: string;
  projects?: { ref: string; name: string; region: string; status: string }[];
  created_at: string;
};

export type Usage = {
  since: string;
  model_calls: number;
  tokens: number;
  sandbox_seconds: number;
  storage_bytes: number;
  cost_usd: number;
  by_kind: Record<string, number>;
};

/**
 * A stored message. `parts` is the folded form of the stream and is already the
 * shape `useChat` holds, so a hydrated thread and a live one render identically.
 */
export type StoredMessage = {
  id: string;
  role: "user" | "assistant";
  parts: unknown[];
  model: string | null;
  created_at: string;
};

/** Codes worth branching on, per the guide's error table. */
export type ApiErrorCode =
  | "busy"
  | "rate_limited"
  | "not_configured"
  | "sandbox_unavailable"
  | "snapshot_failed"
  | "bad_asset"
  | "not_found"
  | "nothing_to_undo"
  | "unauthorized"
  | "upstream_unreachable"
  | (string & {});

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly requestId: string | null = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * The async shape every screen reads.
 *
 * This deliberately replaces the old `Snapshot<T>` union, whose states were
 * `"ssr" | "ready"`. Because `"ssr"` and `"loading"` do not overlap, the
 * compiler flags every stale `=== "ssr"` comparison as an error, which is how
 * the migration finds its own call sites.
 */
export type Async<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; error: ApiError; retry: () => void };

export const LOADING: Async<never> = { status: "loading" };
