const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000_000],
  ["month", 2_592_000_000],
  ["week", 604_800_000],
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

/**
 * "9 hours ago", "yesterday", "3 weeks ago".
 *
 * Reads the clock, so it must only run on the client — rendering it during SSR
 * would bake a timestamp into the HTML that is wrong by the time anyone sees it.
 */
export function formatRelative(at: number, now = Date.now()): string {
  const diff = at - now;
  const abs = Math.abs(diff);
  if (abs < 45_000) return "just now";

  for (const [unit, ms] of UNITS) {
    if (abs >= ms) return relative.format(Math.round(diff / ms), unit);
  }
  return "just now";
}

const DAY_MS = 86_400_000;

/** Recency buckets for the projects list, matching the grouping Lovable uses. */
export function isRecent(at: number, days = 14, now = Date.now()) {
  return now - at < days * DAY_MS;
}
