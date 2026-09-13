import { exchangeDecaneToken, signInErrorResponse } from "@/lib/server/decane";

/**
 * Finishes the Google redirect: the callback page hands over the `decane_jwt`
 * Decane put in the URL, and this trades it for a Vivid session.
 */
export async function POST(request: Request) {
  let body: { jwt?: unknown; name?: unknown; email?: unknown; picture?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: { code: "bad_request", message: "Expected JSON." } }, { status: 400 });
  }

  if (typeof body.jwt !== "string" || !body.jwt) {
    return Response.json({ error: { code: "bad_request", message: "Missing sign-in token." } }, { status: 400 });
  }

  try {
    return Response.json(
      await exchangeDecaneToken(body.jwt, {
        name: typeof body.name === "string" ? body.name : undefined,
        email: typeof body.email === "string" ? body.email : undefined,
        picture: typeof body.picture === "string" ? body.picture : undefined,
      }),
    );
  } catch (error) {
    return signInErrorResponse(error);
  }
}
