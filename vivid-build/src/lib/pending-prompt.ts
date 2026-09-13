const KEY = "vb:v1:pending-prompt";

/**
 * Carries the prompt typed on the landing page across the sign-in modal into
 * the dashboard composer.
 *
 * sessionStorage, not the persisted store: this is a one-shot handoff inside a
 * single tab, and it should not outlive the tab or follow the user to another
 * one. It is deliberately not a URL parameter either — the prompt is the user's
 * own words, and they should not end up in a shareable link or in history.
 */
export function setPendingPrompt(prompt: string) {
  const value = prompt.trim();
  if (!value) return;
  try {
    sessionStorage.setItem(KEY, value);
  } catch {
    // Private mode or storage disabled; the prompt is simply not carried over.
  }
}

/** Reads and clears it, so a reload of the dashboard does not refill the box. */
export function takePendingPrompt(): string {
  try {
    const value = sessionStorage.getItem(KEY);
    if (value) sessionStorage.removeItem(KEY);
    return value ?? "";
  } catch {
    return "";
  }
}
