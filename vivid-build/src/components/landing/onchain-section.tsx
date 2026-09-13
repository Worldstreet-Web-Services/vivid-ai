import Link from "next/link";
import { AuthButton } from "@/components/auth/auth-button";
import { Bullet } from "@/components/ui/bullet";
import { InteractiveCard } from "@/components/ui/interactive-card";
import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/cn";
import { autoFitGrid, buttonClass } from "@/lib/ui";
import { ONCHAIN_POINTS, ONCHAIN_STATS } from "./data";
import { ProductShot } from "./product-shots";

export function OnchainSection() {
  return (
    <section id="onchain" className="border-t border-line px-gutter py-[clamp(64px,9vw,120px)]">
      <div className={cn("mx-auto grid max-w-[1180px] items-center gap-[clamp(28px,4vw,64px)]", autoFitGrid[300])}>
        <div>
          <Reveal
            as="h2"
            className="mt-3.5 text-[clamp(30px,4.2vw,52px)] leading-[1.06] font-extrabold tracking-[-0.035em]"
          >
            Ship dapps, not just apps.
          </Reveal>
          <p className="mt-[18px] max-w-[480px] text-[17px] leading-[1.6] text-pretty text-muted">
            Describe a token gate, an NFT marketplace or a DAO treasury tool in the same plain language. VividBuild
            writes the contracts, the indexer and the frontend, then deploys the whole thing to Ark-Konstellation.
          </p>
          <ul className="mt-6 flex flex-col gap-3">
            {ONCHAIN_POINTS.map((point) => (
              <Bullet key={point} className="text-[15px] leading-normal text-fg-2">
                {point}
              </Bullet>
            ))}
          </ul>
          <div className="mt-[26px] flex flex-wrap items-center gap-3">
            <AuthButton magnetic className={buttonClass()}>
              Build a dapp
            </AuthButton>
            <Link href="/contact" className={buttonClass({ variant: "secondary" })}>
              Read the chain docs
            </Link>
          </div>
        </div>

        <InteractiveCard
          tilt
          glow
          className="rounded-[22px] border border-line-2 bg-surface p-[clamp(20px,2.4vw,30px)]"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold tracking-[0.06em] text-fg">ARK-KONSTELLATION</span>
            <span className="inline-flex items-center gap-[7px] rounded-full border border-line-3 px-2.5 py-[5px] text-[11px] font-semibold text-fg-2">
              <span aria-hidden className="block size-1.5 rounded-full bg-accent" />
              Mainnet live
            </span>
          </div>
          <div className="relative mt-[18px] h-[clamp(150px,16vw,190px)] overflow-hidden rounded-[14px] border border-line-2">
            <ProductShot kind="chain" className="p-3" />
          </div>
          <dl className="mt-[18px] grid grid-cols-3 gap-2.5">
            {ONCHAIN_STATS.map((stat) => (
              <div key={stat.label} className="flex flex-col-reverse rounded-xl border border-line-2 p-3">
                <dt className="mt-1 text-[11px] font-semibold text-muted-2">{stat.label}</dt>
                <dd className="text-xl font-extrabold tracking-[-0.03em] text-fg">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </InteractiveCard>
      </div>
    </section>
  );
}
