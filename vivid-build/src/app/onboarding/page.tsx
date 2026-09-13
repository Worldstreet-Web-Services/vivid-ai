import type { Metadata } from "next";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

export const metadata: Metadata = {
  title: "Welcome",
  robots: { index: false, follow: false },
};

export default function OnboardingPage() {
  return (
    <main id="main">
      <OnboardingFlow />
    </main>
  );
}
