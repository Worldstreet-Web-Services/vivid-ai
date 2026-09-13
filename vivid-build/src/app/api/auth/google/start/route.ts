import { googleConsentUrl } from "@/lib/server/decane-oauth";

/** Sends the browser to Google's consent screen. Decane returns it to the registered callback. */
export async function GET() {
  try {
    return Response.redirect(await googleConsentUrl(), 302);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google sign-in is unavailable.";
    // Bounced back to the app with the reason, so the modal can show it rather
    // than leaving the user on a blank error page.
    return Response.redirect(`/?auth_error=${encodeURIComponent(message)}`, 302);
  }
}
