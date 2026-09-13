import { BuildLoopSection } from "@/components/landing/build-loop-section";
import { BuildRunProvider } from "@/components/landing/build-run-context";
import { CompareSection } from "@/components/landing/compare-section";
import { FaqSection } from "@/components/landing/faq-section";
import { FinalCta } from "@/components/landing/final-cta";
import { HeroSection } from "@/components/landing/hero-section";
import { OnchainSection } from "@/components/landing/onchain-section";
import { PlatformSection } from "@/components/landing/platform-section";
import { SpecsSection } from "@/components/landing/specs-section";

export default function HomePage() {
  return (
    <BuildRunProvider>
      <HeroSection />
      <PlatformSection />
      <BuildLoopSection />
      <SpecsSection />
      <OnchainSection />
      <CompareSection />
      <FaqSection />
      <FinalCta />
    </BuildRunProvider>
  );
}
