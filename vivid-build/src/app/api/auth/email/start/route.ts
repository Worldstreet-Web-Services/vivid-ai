import { signInErrorResponse, startEmailSignIn } from "@/lib/server/decane";

export async function POST(request: Request) {
  let email: unknown;
  try {
    ({ email } = await request.json());
  } catch {
    return Response.json({ error: { code: "bad_request", message: "Expected JSON." } }, { status: 400 });
  }

  if (typeof email !== "string" || !email.includes("@")) {
    return Response.json({ error: { code: "bad_request", message: "Enter an email address." } }, { status: 400 });
  }

  try {
    await startEmailSignIn(email.trim());
    // Always 202, address known or not: Decane is non-enumerating by design and
    // so is this, so never surface "no account with that email".
    return new Response(null, { status: 202 });
  } catch (error) {
    return signInErrorResponse(error);
  }
}
