"use client";

import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "./client";
import { getTokens, setTokens, subscribeToTokens } from "./tokens";
import { ApiError, type Tokens, type User } from "./types";

type SessionStatus = "loading" | "authenticated" | "anonymous";

type SessionValue = {
  status: SessionStatus;
  user: User | null;
  /** Emails a 6-digit code. Resolves whether or not the address is known. */
  startEmailSignIn: (email: string) => Promise<void>;
  verifyEmailCode: (email: string, code: string) => Promise<User>;
  /** Finishes Decane's Google redirect, which returns a Decane JWT in the URL. */
  signInWithDecaneJwt: (jwt: string, profile?: { name?: string; email?: string; picture?: string }) => Promise<User>;
  signOut: () => void;
};

const SessionContext = createContext<SessionValue | null>(null);

async function postAuth<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = (await response.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
    throw new ApiError(
      response.status,
      detail.error?.code ?? String(response.status),
      detail.error?.message ?? "Sign-in failed.",
    );
  }
  // "Code sent" answers 202 with no body. Parsing that as JSON throws a
  // SyntaxError, which is not an ApiError, so it surfaced as the generic
  // "Something went wrong" even though the email had gone out.
  if (response.status === 202 || response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<SessionStatus>("loading");

  // Confirms the stored pair still works, and picks up a sign-out from
  // another tab. Runs again whenever the tokens change.
  useEffect(() => {
    let cancelled = false;

    const check = () => {
      if (!getTokens()) {
        if (!cancelled) {
          setUser(null);
          setStatus("anonymous");
        }
        return;
      }
      api
        .get<User>("/auth/me")
        .then((me) => {
          if (cancelled) return;
          setUser(me);
          setStatus("authenticated");
        })
        .catch((error: unknown) => {
          if (cancelled) return;

          // Only the backend rejecting the credentials is grounds for signing
          // someone out. `authFetch` has already tried a refresh by the time a
          // 401 reaches here, so this really is "that session is over".
          const rejected = error instanceof ApiError && (error.status === 401 || error.status === 403);
          if (rejected) {
            setTokens(null);
            setUser(null);
            setStatus("anonymous");
            return;
          }

          // Anything else — a 500, an offline moment, the dev server restarting
          // a route mid-request — is not the user's problem. Clearing the pair
          // here dropped people on the sign-in modal in the middle of a build.
          // The token payload carries the user, so the app stays usable.
          const stored = getTokens();
          if (!stored) {
            setUser(null);
            setStatus("anonymous");
            return;
          }
          console.warn("[auth] could not reach /auth/me; keeping the session", error);
          setUser((current) => current ?? stored.user);
          setStatus("authenticated");
        });
    };

    check();
    const unsubscribe = subscribeToTokens(() => {
      if (!cancelled) check();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const adopt = useCallback((tokens: Tokens) => {
    setTokens(tokens);
    setUser(tokens.user);
    setStatus("authenticated");
    return tokens.user;
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      user,
      startEmailSignIn: (email) => postAuth<void>("/api/auth/email/start", { email }),
      verifyEmailCode: async (email, code) => adopt(await postAuth<Tokens>("/api/auth/email/verify", { email, code })),
      signInWithDecaneJwt: async (jwt, profile) =>
        adopt(await postAuth<Tokens>("/api/auth/decane-jwt", { jwt, ...profile })),
      signOut: () => {
        setTokens(null);
        setUser(null);
        setStatus("anonymous");
      },
    }),
    [status, user, adopt],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): SessionValue {
  const context = use(SessionContext);
  if (!context) throw new Error("useSession must be used inside <SessionProvider>");
  return context;
}
