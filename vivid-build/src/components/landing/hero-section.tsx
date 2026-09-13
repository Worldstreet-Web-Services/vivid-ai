import { Glow } from "@/components/ui/glow";
import { HeroBackdrop } from "./hero-backdrop";
import { HeroPrompt } from "./hero-prompt";

export function HeroSection() {
  return (
    <section className="relative px-gutter pt-[clamp(56px,9vw,120px)] pb-[clamp(36px,5vw,64px)]">
      <Glow className="-top-[180px]" />
      <HeroBackdrop />
      <div className="relative z-1 mx-auto max-w-[1120px] text-center">
        <h1 className="mx-auto max-w-[900px] text-[clamp(42px,6.6vw,84px)] leading-none font-extrabold tracking-[-0.045em] text-balance">
          Describe it once.
          <br />
          <span className="text-accent">Ship it for real.</span>
        </h1>
        <HeroPrompt />
      </div>
    </section>
  );
}
