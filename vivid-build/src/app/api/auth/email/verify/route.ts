import { signInErrorResponse, verifyEmailSignIn } from "@/lib/server/decane";

export async function POST(request: Request) {
  let body: { email?: unknown; code?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: { code: "bad_request", message: "Expected JSON." } }, { status: 400 });
  }

  const { email, code } = body;
  if (typeof email !== "string" || typeof code !== "string" || !code.trim()) {
    return Response.json({ error: { code: "bad_request", message: "Enter the code from your email." } }, { status: 400 });
  }

  try {
    return Response.json(await verifyEmailSignIn(email.trim(), code.trim()));
  } catch (error) {
    return signInErrorResponse(error);
  }
}
