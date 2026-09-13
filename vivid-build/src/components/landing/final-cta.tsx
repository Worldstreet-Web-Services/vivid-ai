import Link from "next/link";
import { AuthButton } from "@/components/auth/auth-button";
import { Glow } from "@/components/ui/glow";
import { buttonClass } from "@/lib/ui";

export function FinalCta() {
  return (
    <section id="cta" className="relative overflow-hidden px-gutter py-[clamp(80px,11vw,150px)]">
      <Glow strong className="-bottom-[260px] w-[1000px]" />
      <div className="relative mx-auto max-w-[760px] text-center">
        <h2 className="text-[clamp(34px,5.4vw,68px)] leading-none font-extrabold tracking-[-0.045em] text-balance">
          Your next app is one paragraph away.
        </h2>
        <p className="mx-auto mt-5 max-w-[480px] text-[17px] leading-[1.6] text-muted">
          Start free, upgrade when you have users. Export your code on any paid plan, no lock-in, no rewrite.
        </p>
        <div className="mt-[34px] flex flex-wrap justify-center gap-3">
          <AuthButton magnetic className={buttonClass({ size: "lg" })}>
            Start building free
          </AuthButton>
          <Link href="/contact" className={buttonClass({ variant: "secondary", size: "lg" })}>
            Talk to us
          </Link>
        </div>
      </div>
    </section>
  );
}
