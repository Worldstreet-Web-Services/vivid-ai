import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { MailIcon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { AppText } from "@/components/ui/text";
import { AuthCard } from "@/features/auth/components/auth-card";
import { validateEmail } from "@/features/auth/lib/validation";
import { useTheme } from "@/hooks/use-theme";
import { decaneConfigured, startEmailSignIn } from "@/lib/backend/decane";

const NOT_CONFIGURED =
  "Sign-in isn't configured yet (set EXPO_PUBLIC_DECANE_APP_ID and EXPO_PUBLIC_DECANE_API_KEY).";

// One way in: a Vivid account, opened with a code emailed to the address you
// type. There are no third-party sign-in buttons. Every Vivid surface, the web
// app, this app, the CLI and the editor, authenticates against the same
// account, so identity stays ours rather than a provider's.
//
// Decane is the delivery mechanism for the code, not a separate identity. It
// never sees a password, because there is none.
export function SignInForm() {
  const router = useRouter();
  const { theme } = useTheme();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function signIn() {
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
      router.push({ pathname: "/verify", params: { email: address } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the code");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Sign in with Vivid"
      subtitle="Ask anything, and see it come to life."
      footer={
        <AppText size={12.5} weight="regular" tone={0.45} align="center">
          By continuing you agree to the{" "}
          <AppText size={12.5} tone={0.7}>
            Terms
          </AppText>{" "}
          and{" "}
          <AppText size={12.5} tone={0.7}>
            Privacy Policy
          </AppText>
          .
        </AppText>
      }
    >
      <View style={{ gap: 16 }}>
        <Field label="Email" error={error ?? undefined}>
          <Input
            leading={<MailIcon size={16} color={theme.fg(0.35)} />}
            placeholder="you@example.com"
            value={email}
            invalid={Boolean(error)}
            onChangeText={(value) => {
              setEmail(value);
              if (error) setError(null);
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="go"
            onSubmitEditing={() => void signIn()}
          />
        </Field>

        <Button
          label="Continue"
          loading={submitting}
          disabled={submitting}
          fullWidth
          onPress={() => void signIn()}
        />
      </View>

      <AppText size={12.5} weight="regular" tone={0.45} align="center" style={{ marginTop: 16 }}>
        We email you a six-digit code. No password to remember.
      </AppText>
    </AuthCard>
  );
}
