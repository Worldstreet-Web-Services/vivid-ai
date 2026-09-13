"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoMark } from "@/components/brand/logo";
import { useSession } from "@/lib/api/session";
import { buttonClass } from "@/lib/ui";

/**
 * Completes Decane's Google redirect.
 *
 * Decane hands the result back as query parameters, so the first thing this
 * does after reading them is strip them from the URL — a `decane_jwt` sitting
 * in history, or in a link someone copies, is a live credential.
 */
export function GoogleCallback() {
  const params = useSearchParams();
  const router = useRouter();
  const { signInWithDecaneJwt } = useSession();

  // Captured once, because the effect below strips these from the URL — reading
  // them later would find nothing.
  const [result] = useState(() => ({
    failure: params.get("decane_error"),
    jwt: params.get("decane_jwt"),
    isNew: params.get("decane_is_new_user") === "true",
    profile: {
      name: params.get("decane_name") ?? undefined,
      email: params.get("decane_email") ?? undefined,
      picture: params.get("decane_picture") ?? undefined,
    },
  }));

  const initialError = result.failure
    ? result.failure === "access_denied"
      ? "Google sign-in was cancelled."
      : `Google sign-in failed: ${result.failure}`
    : result.jwt
      ? null
      : "That sign-in link is missing its token.";

  const [error, setError] = useState<string | null>(initialError);

  useEffect(() => {
    // A decane_jwt left in the address bar is a live credential: it would sit in
    // history and travel in any copied link.
    window.history.replaceState({}, "", "/auth/callback");
  }, []);

  useEffect(() => {
    if (!result.jwt) return;

    let cancelled = false;
    signInWithDecaneJwt(result.jwt, result.profile)
      .then(() => {
        if (!cancelled) router.replace(result.isNew ? "/onboarding" : "/dashboard");
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not finish signing in.");
      });

    return () => {
      cancelled = true;
    };
  }, [result, router, signInWithDecaneJwt]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <LogoMark size="lg" />
      {error ? (
        <>
          <p className="max-w-[420px] rounded-lg bg-warn/20 px-3 py-2 text-[13px] leading-[1.5] text-fg-2">{error}</p>
          <Link href="/" className={buttonClass({ variant: "secondary", size: "sm" })}>
            Back to VividBuild
          </Link>
        </>
      ) : (
        <p className="text-sm text-muted">Finishing sign-in…</p>
      )}
    </div>
  );
}
