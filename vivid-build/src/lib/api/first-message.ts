/**
 * Carries the prompt typed on the dashboard into the workspace that was just
 * created for it.
 *
 * Creating a project and describing it are two API calls, and the second one
 * belongs to the workspace (it owns the chat transport). Keyed per project so
 * two tabs starting two projects cannot cross, and read-once so a reload does
 * not send the same first message twice.
 */
const key = (projectId: string) => `vb:v1:first-message:${projectId}`;

export function setFirstMessage(projectId: string, text: string) {
  try {
    sessionStorage.setItem(key(projectId), text);
  } catch {
    // Private mode. The workspace simply opens with an empty thread.
  }
}

export function takeFirstMessage(projectId: string): string | null {
  try {
    const value = sessionStorage.getItem(key(projectId));
    if (value) sessionStorage.removeItem(key(projectId));
    return value;
  } catch {
    return null;
  }
}
