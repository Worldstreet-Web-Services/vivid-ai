/** Joins truthy class names. Keeps conditional Tailwind classes readable. */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
