"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { BrandIcon } from "@/components/brand/connector-logo";
import { LogoMark } from "@/components/brand/logo";
import { useSession } from "@/lib/api/session";
import { ApiError } from "@/lib/api/types";
import type { AuthMode } from "./auth-modal-provider";

type AuthModalProps = {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  onClose: () => void;
};

const fieldClass =
  "w-full rounded-xl border border-line-2 bg-surface-2 px-[15px] py-3.5 text-[15px] text-fg outline-none focus-visible:border-line-3";

const providerButton =
  "flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl border border-line-2 px-4 py-[13px] text-[15px] font-semibold text-fg transition-colors hover:border-line-3";

export function AuthModal({ mode, onModeChange, onClose }: AuthModalProps) {
  const router = useRouter();
  const { startEmailSignIn, verifyEmailCode } = useSession();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  /** "email" collects the address, "code" the six digits Decane just sent. */
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const emailId = useId();
  const codeId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const isLogin = mode === "login";

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);

  const message = (caught: unknown) =>
    caught instanceof ApiError ? caught.message : "Something went wrong. Try again.";

  // A brand-new account still gets the onboarding questions; a returning one
  // goes straight to work. `isNewUser` lives on the Decane result, which the
  // server keeps, so the modal's own mode is the best signal available here.
  const land = () => {
    onClose();
    router.push(isLogin ? "/dashboard" : "/onboarding");
  };

  const sendCode = async () => {
    setBusy(true);
    setError(null);
    try {
      await startEmailSignIn(email.trim());
      setStep("code");
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  };

  const confirmCode = async () => {
    setBusy(true);
    setError(null);
    try {
      await verifyEmailCode(email.trim(), code.trim());
      land();
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-200 flex items-center justify-center bg-[rgba(6,7,9,0.62)] p-5 backdrop-blur-[6px]">
      <div aria-hidden className="absolute inset-0" onClick={onClose} />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative max-h-[92vh] w-full max-w-[420px] overflow-auto rounded-[22px] border border-line-2 bg-surface p-[clamp(22px,3vw,30px)] shadow-[0_50px_110px_-50px_rgba(0,0,0,0.85)] outline-none"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 flex size-[30px] cursor-pointer items-center justify-center rounded-full border border-line-2"
        >
          <X aria-hidden className="size-3.5 text-muted" />
        </button>

        <LogoMark size="lg" />
        <p className="mt-5 text-xl font-semibold tracking-[-0.02em] text-muted">Start building.</p>
        <h2 id={titleId} className="mt-0.5 text-[26px] font-extrabold tracking-[-0.035em] text-fg">
          {step === "code" ? "Check your email" : isLogin ? "Welcome back" : "Create free account"}
        </h2>
        {step === "code" && (
          <p className="mt-2 text-sm leading-[1.55] text-muted">
            We sent a 6-digit code to <span className="font-semibold text-fg-2">{email}</span>.
          </p>
        )}

        {step === "email" && (
          <>
            <div className="mt-[22px] flex flex-col gap-2.5">
              {/* A real navigation, not a router push: this leaves the app for
                  Decane's consent URL and comes back to /auth/callback. Decane
                  owns the whole flow, so no Google client id lives here. */}
              <a href="/api/auth/google/start" className={providerButton}>
                <BrandIcon id="google" className="size-[17px]" />
                Continue with Google
              </a>
            </div>

            <div className="my-[18px] flex items-center gap-3">
              <span className="block h-px flex-1 bg-line-2" />
              <span className="text-[11px] font-bold tracking-[0.14em] text-muted-3">OR</span>
              <span className="block h-px flex-1 bg-line-2" />
            </div>
          </>
        )}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (busy) return;
            void (step === "email" ? sendCode() : confirmCode());
          }}
        >
          {step === "email" ? (
            <>
              <label htmlFor={emailId} className="sr-only">
                Email
              </label>
              <input
                id={emailId}
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email"
                className={fieldClass}
              />
            </>
          ) : (
            <>
              <label htmlFor={codeId} className="sr-only">
                Six-digit code
              </label>
              <input
                id={codeId}
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className={`${fieldClass} text-center text-xl tracking-[0.4em] tabular-nums`}
              />
            </>
          )}

          {error && (
            // Bare text-warn is too muted to read on the dark ground; the tint
            // is what makes this register as an error rather than a hint.
            <p
              role="alert"
              className="mt-2.5 rounded-lg bg-warn/20 px-3 py-2 text-[13px] leading-[1.5] text-fg-2"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-3 w-full cursor-pointer rounded-xl bg-btn px-4 py-3.5 text-[15px] font-bold text-btn-fg shadow-sheen disabled:cursor-wait disabled:opacity-70"
          >
            {busy
              ? step === "email"
                ? "Sending…"
                : "Checking…"
              : step === "email"
                ? isLogin
                  ? "Continue"
                  : "Create account"
                : "Sign in"}
          </button>

          {step === "code" && (
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setCode("");
                setError(null);
              }}
              className="mt-2.5 w-full cursor-pointer text-[13px] font-semibold text-muted transition-colors hover:text-fg"
            >
              Use a different email
            </button>
          )}
        </form>

        <p className="mt-4 text-xs leading-[1.55] text-muted">
          By continuing, you agree to the{" "}
          <a href="#" className="border-b border-line-3 text-muted">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="#" className="border-b border-line-3 text-muted">
            Privacy Policy
          </a>
          .
        </p>
        {/* A line promising SSO on Team and Enterprise plans lived here. There
            is no SSO, and there are no plans — the only sign-in the backend has
            is the Decane email code and Google above. */}
        <p className="mt-4 border-t border-line pt-3.5 text-center text-[13px] text-muted">
          {isLogin ? "New here?" : "Already building?"}{" "}
          <button
            type="button"
            onClick={() => onModeChange(isLogin ? "signup" : "login")}
            className="cursor-pointer text-[13px] font-semibold text-fg underline"
          >
            {isLogin ? "Create an account" : "Log in"}
          </button>
        </p>
      </div>
    </div>
  );
}
