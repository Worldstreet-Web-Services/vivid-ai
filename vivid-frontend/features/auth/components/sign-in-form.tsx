"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MailIcon } from "@/components/ui/icons";
import { AuthCard } from "@/features/auth/components/auth-card";
import { ProviderButton } from "@/features/auth/components/provider-buttons";
import { validateEmail } from "@/features/auth/lib/validation";

// There is no auth service behind this yet. The form validates and routes, so
// the flow can be walked end to end, and the submit handler is the single place
// a real sign-in call slots into later.
export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const problem = validateEmail(email);
    setError(problem);
    if (problem) return;

    setSubmitting(true);
    router.push(`/verify?email=${encodeURIComponent(email.trim())}`);
  }

  return (
    <AuthCard
      title="Sign in to Vivid"
      subtitle="Ask anything, and see it come to life."
      footer={
        <>
          By continuing you agree to the{" "}
          <span className="text-white/70 underline underline-offset-2">Terms</span> and{" "}
          <span className="text-white/70 underline underline-offset-2">Privacy Policy</span>.
        </>
      }
    >
      <div className="flex flex-col gap-2.5">
        <ProviderButton provider="google" disabled={submitting} />
        <ProviderButton provider="apple" disabled={submitting} />
      </div>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-white/10" />
        <span className="text-[11.5px] font-medium tracking-wide text-white/35 uppercase">or</span>
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Field htmlFor="email" label="Email" error={error ?? undefined}>
          <div className="relative">
            <MailIcon
              size={16}
              className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-white/35"
            />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              invalid={Boolean(error)}
              aria-describedby={error ? "email-error" : undefined}
              onChange={(event) => {
                setEmail(event.target.value);
                if (error) setError(null);
              }}
              className="pl-10"
            />
          </div>
        </Field>

        <Button type="submit" size="lg" fullWidth loading={submitting}>
          Continue with email
        </Button>
      </form>
    </AuthCard>
  );
}
