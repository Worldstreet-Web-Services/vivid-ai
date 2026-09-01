"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MailIcon } from "@/components/ui/icons";
import { AuthCard } from "@/features/auth/components/auth-card";
import { validateEmail } from "@/features/auth/lib/validation";
import { decaneConfigured, startEmailSignIn } from "@/lib/backend/decane";

const NOT_CONFIGURED =
  "Sign-in isn't configured yet (set DECANE_APP_ID and DECANE_API_KEY).";

// One way in: a Vivid account, opened with a code emailed to the address you
// type. There are no third-party sign-in buttons. Every Vivid surface, the web
// app, the mobile app, the CLI and the editor, authenticates against the same
// account, so identity stays ours rather than a provider's.
//
// Decane is the delivery mechanism for the code, not a separate identity. It
// never sees a password, because there is none.
export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    const problem = validateEmail(email);
    if (problem) {
      setError(problem);
      return;
    }
    if (!decaneConfigured) {
      setError(NOT_CONFIGURED);
      return;
    }
    setError(null);
    setSubmitting(true);
    const address = email.trim().toLowerCase();
    try {
      await startEmailSignIn(address);
      router.push(`/verify?email=${encodeURIComponent(address)}`);
    } catch (err) {
      setSubmitting(false);
      setError(err instanceof Error ? err.message : "Could not send the code");
    }
  }

  return (
    <AuthCard
      title="Sign in with Vivid"
      subtitle="Ask anything, and see it come to life."
      footer={
        <>
          By continuing you agree to the{" "}
          <span className="text-fg/70 underline underline-offset-2">Terms</span> and{" "}
          <span className="text-fg/70 underline underline-offset-2">Privacy Policy</span>.
        </>
      }
    >
      <form onSubmit={signIn} noValidate className="flex flex-col gap-4">
        <Field htmlFor="email" label="Email" error={error ?? undefined}>
          <div className="relative">
            <MailIcon
              size={16}
              className="text-fg/35 pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2"
            />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              invalid={Boolean(error)}
              onChange={(event) => {
                setEmail(event.target.value);
                if (error) setError(null);
              }}
              className="pl-10"
            />
          </div>
        </Field>

        <Button type="submit" loading={submitting} className="w-full">
          Continue
        </Button>
      </form>

      <p className="text-fg/45 mt-4 text-center text-[12.5px]">
        We email you a six-digit code. No password to remember.
      </p>
    </AuthCard>
  );
}
