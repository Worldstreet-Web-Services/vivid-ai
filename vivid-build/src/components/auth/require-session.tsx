"use client";

import { useEffect, type ReactNode } from "react";
import { useSession } from "@/lib/api/session";
import { buttonClass } from "@/lib/ui";
import { LogoMark } from "@/components/brand/logo";
import { useAuthModal } from "./auth-modal-provider";

/**
 * Gates the signed-in app.
 *
 * Deliberately not a redirect: the URL survives, so someone opening a link to a
 * project lands on that project once they sign in. A server-side guard is not
 * possible anyway — the token lives in localStorage, which no middleware sees.
 */
export function RequireSession({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const { openAuth } = useAuthModal();

  useEffect(() => {
    if (status === "anonymous") openAuth("login");
  }, [status, openAuth]);

  if (status === "authenticated") return <>{children}</>;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <LogoMark size="lg" />
      {status === "loading" ? (
        <p className="text-sm text-muted">Checking your session…</p>
      ) : (
        <>
          <div>
            <h1 className="text-lg font-bold text-fg">Sign in to continue</h1>
            <p className="mt-1.5 text-sm text-muted">This page needs an account. You will come straight back here.</p>
          </div>
          <button type="button" onClick={() => openAuth("login")} className={buttonClass({ size: "md" })}>
            Sign in
          </button>
        </>
      )}
    </div>
  );
}
