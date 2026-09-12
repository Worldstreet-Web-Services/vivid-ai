import { createClient } from "@supabase/supabase-js";

// Set by the builder in .env when a Supabase backend is linked to the
// project. Without them the client still constructs, so a page that does
// not touch data keeps working, and any query fails with a clear message.
const url = import.meta.env.VITE_SUPABASE_URL ?? "";
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

export const supabaseConfigured = Boolean(url && anonKey);

export const supabase = createClient(url || "https://not-configured.supabase.co", anonKey || "not-configured");
