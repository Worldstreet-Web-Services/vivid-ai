/**
 * What is left of the local store.
 *
 * Projects, files, versions and identity all live on the server now. These are
 * the settings that belong to this browser rather than to the account, so they
 * are the only things still worth persisting here.
 */

export const SCHEMA_VERSION = 1;

export type Prefs = {
  v: number;
  workspace: {
    device: "desktop" | "tablet" | "phone";
    codeWrap: boolean;
    /** Applied to the code viewer, in px. */
    codeFontSize: number;
    expandedDirs: string[];
    /** Desktop sidebar shown as an icon-only rail. */
    sidebarCollapsed: boolean;
  };
};

/* --------------------------------------------------------------- snapshot -- */

/**
 * Server and first-client render return the `ssr` sentinel, which is distinct
 * from "loaded and genuinely empty". Screens branch on it to show skeletons
 * instead of flashing "No projects yet" at every returning user.
 */
export type Snapshot<T> = { status: "ssr" } | { status: "ready"; data: T };

export const SSR_SNAPSHOT: Snapshot<never> = Object.freeze({ status: "ssr" });
