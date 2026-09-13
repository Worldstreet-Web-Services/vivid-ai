/** Human-readable ids — `/projects/sole-and-step` reads better than a UUID in a screenshot. */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
    .replace(/-+$/g, "");
}

/**
 * A slug that is not already taken, suffixing `-2`, `-3`… on collision.
 * Falls back to a timestamp when the source has no usable characters
 * (an emoji-only prompt, for example).
 */
export function uniqueId(base: string, taken: Iterable<string>): string {
  const root = slugify(base) || `project-${Date.now().toString(36)}`;
  const used = new Set(taken);
  if (!used.has(root)) return root;
  for (let n = 2; n < 500; n++) {
    const candidate = `${root}-${n}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

/** Stable unique id for records that are never addressed by URL. */
export function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
