"use client";

import { useState } from "react";
import { AuthButton } from "@/components/auth/auth-button";
import { cn } from "@/lib/cn";
import { autoFitGrid } from "@/lib/ui";
import { PLANS, type Plan } from "./data";

type Billing = "monthly" | "yearly";

const BILLING_OPTIONS: { value: Billing; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly, save 20%" },
];

export function BillingPlans() {
  const [billing, setBilling] = useState<Billing>("monthly");

  return (
    <>
      <div className="text-center">
        <div
          role="group"
          aria-label="Billing period"
          className="mt-7 inline-flex items-center gap-1 rounded-full border border-line-2 bg-surface p-1"
        >
          {BILLING_OPTIONS.map((option) => {
            const active = option.value === billing;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => setBilling(option.value)}
                className={cn(
                  "cursor-pointer rounded-full px-[18px] py-[9px] text-sm font-semibold whitespace-nowrap",
                  active ? "bg-btn text-btn-fg" : "text-muted",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className={cn("mt-[clamp(32px,4vw,52px)] grid items-stretch gap-3.5", autoFitGrid[260])}>
        {PLANS.map((plan) => (
          <PlanCard key={plan.name} plan={plan} billing={billing} />
        ))}
      </div>
    </>
  );
}

function PlanCard({ plan, billing }: { plan: Plan; billing: Billing }) {
  const { featured = false } = plan;

  return (
    <article
      className={cn(
        "flex flex-col gap-[22px] rounded-[22px] border p-[clamp(22px,2.4vw,30px)]",
        featured ? "border-line-3 bg-surface-2" : "border-line-2 bg-surface",
      )}
    >
      <div>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[17px] font-bold tracking-[-0.02em] text-fg">{plan.name}</h2>
          {plan.badge && (
            <span className="flex-none rounded-full bg-btn px-2.5 py-[5px] text-[10px] font-bold tracking-[0.08em] whitespace-nowrap text-btn-fg uppercase">
              {plan.badge}
            </span>
          )}
        </div>
        <p className="mt-3.5 flex items-baseline gap-2">
          <span className="text-[clamp(34px,4vw,46px)] font-extrabold tracking-[-0.045em] text-fg">
            {plan.price[billing]}
          </span>
          <span className="text-[13px] text-muted-2">{plan.per}</span>
        </p>
        <p className="mt-3 text-sm leading-[1.55] text-pretty text-muted">{plan.body}</p>
      </div>

      <AuthButton
        className={cn(
          "block w-full cursor-pointer rounded-full border px-5 py-[13px] text-center text-[15px] font-semibold",
          featured ? "border-transparent bg-btn text-btn-fg" : "border-line-3 text-fg",
        )}
      >
        {plan.cta}
      </AuthButton>

      <ul className="flex flex-col gap-[11px]">
        {plan.features.map((feature) => (
          <li
            key={feature}
            className={cn("flex gap-2.5 text-sm leading-normal", featured ? "text-fg-2" : "text-muted")}
          >
            <span
              aria-hidden
              className={cn("mt-1.5 block size-1.5 flex-none rounded-full", featured ? "bg-accent" : "bg-muted-3")}
            />
            {feature}
          </li>
        ))}
      </ul>
    </article>
  );
}
