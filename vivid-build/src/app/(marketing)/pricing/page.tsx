import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AuthButton } from "@/components/auth/auth-button";
import { BillingPlans } from "@/components/pricing/billing-plans";
import { ENTERPRISE_IMAGE, PLAN_MATRIX, PRICING_FAQS } from "@/components/pricing/data";
import { FaqList } from "@/components/ui/faq-list";
import { Glow } from "@/components/ui/glow";
import { cn } from "@/lib/cn";
import { buttonClass } from "@/lib/ui";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Flat monthly plans, no per message credits. Every paid VividBuild plan exports its code.",
};

export default function PricingPage() {
  return (
    <>
      <section id="plans" className="relative px-gutter pt-[clamp(56px,8vw,104px)] pb-[clamp(36px,5vw,56px)]">
        <Glow className="-top-[200px]" />
        <div className="relative mx-auto max-w-[1180px]">
          <div className="text-center">
            <h1 className="text-[clamp(36px,5.6vw,68px)] leading-[1.02] font-extrabold tracking-[-0.045em] text-balance">
              Pay for what ships.
            </h1>
            <p className="mx-auto mt-[18px] max-w-[520px] text-[17px] leading-[1.6] text-pretty text-muted">
              Flat monthly plans, no per message credits. Every paid plan exports its code.
            </p>
          </div>
          <BillingPlans />
        </div>
      </section>

      <EnterpriseBanner />
      <PlanMatrix />

      <section id="faq" className="border-t border-line bg-bg-2 px-gutter py-[clamp(56px,8vw,100px)]">
        <div className="mx-auto max-w-[860px]">
          <h2 className="text-[clamp(26px,3.4vw,42px)] leading-[1.08] font-extrabold tracking-[-0.035em]">
            Billing questions
          </h2>
          <div className="mt-7">
            <FaqList items={PRICING_FAQS} />
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden px-gutter py-[clamp(70px,10vw,130px)]">
        <Glow strong className="-bottom-[260px] w-[1000px]" />
        <div className="relative mx-auto max-w-[700px] text-center">
          <h2 className="text-[clamp(30px,4.6vw,58px)] leading-[1.02] font-extrabold tracking-[-0.045em] text-balance">
            Start free. Upgrade when it earns.
          </h2>
          <div className="mt-[30px] flex flex-wrap justify-center gap-3">
            <AuthButton className={buttonClass({ size: "lg" })}>Start building free</AuthButton>
            <a href="#plans" className={buttonClass({ variant: "secondary", size: "lg" })}>
              Compare plans
            </a>
          </div>
        </div>
      </section>
    </>
  );
}

function EnterpriseBanner() {
  return (
    <section className="px-gutter pt-[clamp(24px,4vw,48px)] pb-[clamp(56px,8vw,96px)]">
      <div className="mx-auto grid max-w-[1180px] grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] items-center gap-[clamp(20px,3vw,44px)] overflow-hidden rounded-[22px] border border-line-2 bg-surface p-[clamp(24px,3vw,40px)]">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-accent uppercase">Enterprise</p>
          <h2 className="mt-3.5 text-[clamp(24px,2.8vw,34px)] leading-[1.1] font-extrabold tracking-[-0.035em]">
            Your whole company, building.
          </h2>
          <p className="mt-3 max-w-[440px] text-[15px] leading-[1.6] text-pretty text-muted">
            Unlimited seats, private cloud or your own VPC, SSO with SCIM provisioning, and a named architect for the
            first 90 days.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/contact" className={buttonClass()}>
              Talk to sales
            </Link>
            <Link href="/contact" className={buttonClass({ variant: "secondary" })}>
              Read security docs
            </Link>
          </div>
        </div>
        <div className="relative h-[clamp(180px,20vw,240px)] overflow-hidden rounded-2xl border border-line-2 bg-surface">
          <Image
            src={ENTERPRISE_IMAGE.src}
            alt={ENTERPRISE_IMAGE.alt}
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="filter-shot object-cover"
          />
        </div>
      </div>
    </section>
  );
}

const PLAN_COLUMNS = [
  { key: "free", label: "Free", head: "text-muted font-semibold", cell: "text-muted-2" },
  { key: "pro", label: "Pro", head: "bg-btn text-btn-fg font-bold", cell: "bg-tint text-fg" },
  { key: "team", label: "Team", head: "text-muted font-semibold", cell: "text-fg-2" },
] as const;

function PlanMatrix() {
  return (
    <section className="px-gutter pb-[clamp(64px,9vw,110px)]">
      <div className="mx-auto max-w-[1000px]">
        <h2 className="text-[clamp(26px,3.4vw,40px)] leading-[1.08] font-extrabold tracking-[-0.035em]">
          Compare the plans
        </h2>
        {/* Below `sm` each row stacks: the feature spans the full width above the three plan values. */}
        <div role="table" aria-label="Plan comparison" className="mt-7 overflow-hidden rounded-[18px] border border-line-2">
          <div role="row" className="grid grid-cols-3 bg-surface-2 sm:grid-cols-[1.6fr_1fr_1fr_1fr]">
            <div
              role="columnheader"
              className="hidden px-[18px] py-[15px] text-[11px] font-semibold tracking-[0.1em] text-muted-2 uppercase sm:block"
            >
              Feature
            </div>
            {PLAN_COLUMNS.map((col) => (
              <div
                key={col.key}
                role="columnheader"
                className={cn("px-3 py-[15px] text-[13px] sm:px-[18px]", col.head)}
              >
                {col.label}
              </div>
            ))}
          </div>
          {PLAN_MATRIX.map((row) => (
            <div
              key={row.feature}
              role="row"
              className="grid grid-cols-3 border-t border-line sm:grid-cols-[1.6fr_1fr_1fr_1fr]"
            >
              <div
                role="rowheader"
                className="col-span-3 px-3 pt-3.5 pb-1 text-sm font-medium text-fg sm:col-span-1 sm:px-[18px] sm:py-4"
              >
                {row.feature}
              </div>
              {PLAN_COLUMNS.map((col) => (
                <div
                  key={col.key}
                  role="cell"
                  className={cn("px-3 py-2.5 text-[13px] sm:px-[18px] sm:py-4 sm:text-sm", col.cell)}
                >
                  {row[col.key]}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
