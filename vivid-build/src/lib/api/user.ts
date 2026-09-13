import type { User } from "./types";

/**
 * The address to show a person.
 *
 * `email` is synthesised by the backend when the account came from Decane —
 * `decane_<uuid>@users.vivid`, which is a routing detail and means nothing to
 * the user. The address they actually signed in with is `profile_email`, so
 * that is what every screen shows.
 */
export function displayEmail(user: Pick<User, "email" | "profile_email">): string | null {
  if (user.profile_email) return user.profile_email;
  if (user.email && user.email.endsWith("@users.vivid")) return null;
  return user.email;
}

/** Name, then real address, then a neutral word — never a synthesised address. */
export function displayName(user: Pick<User, "name" | "email" | "profile_email">): string {
  return user.name || displayEmail(user) || "You";
}
