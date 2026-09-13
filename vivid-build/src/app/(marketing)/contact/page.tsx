import type { Metadata } from "next";
import { ContactForm } from "@/components/contact/contact-form";
import { CONTACT_CHANNELS, ENTERPRISE_INCLUDES, NEXT_STEPS } from "@/components/contact/data";
import { Bullet } from "@/components/ui/bullet";
import { Glow } from "@/components/ui/glow";
import { cn } from "@/lib/cn";
import { autoFitGrid } from "@/lib/ui";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Enterprise rollouts, onchain projects on Ark-Konstellation, security reviews or a question about a plan. A human answers.",
};

export default function ContactPage() {
  return (
    <>
      <section id="form" className="relative px-gutter pt-[clamp(48px,7vw,96px)] pb-[clamp(56px,8vw,104px)]">
        <Glow className="-top-[220px]" />
        <div className="relative mx-auto max-w-[1180px]">
          <h1 className="text-[clamp(34px,5vw,60px)] leading-[1.02] font-extrabold tracking-[-0.045em] text-balance">
            Talk to us.
          </h1>
          <p className="mt-[18px] max-w-[560px] text-[17px] leading-[1.6] text-pretty text-muted">
            Enterprise rollouts, onchain projects on Ark-Konstellation, security reviews or a question about a plan. A
            human answers, usually inside one business day.
          </p>
        </div>

        <div
          className={cn(
            "relative mx-auto mt-[clamp(34px,4vw,52px)] grid max-w-[1180px] items-start gap-[clamp(28px,4vw,64px)]",
            autoFitGrid[300],
          )}
        >
          <div>
            <ul className="flex flex-col gap-2.5">
              {CONTACT_CHANNELS.map((channel) => (
                <li
                  key={channel.title}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-[14px] border border-line-2 bg-surface px-[18px] py-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-fg">{channel.title}</p>
                    <p className="mt-1 text-[13px] text-muted-2">{channel.body}</p>
                  </div>
                  <a
                    href={`mailto:${channel.email}`}
                    className="flex-none text-[13px] font-semibold text-fg-2 transition-colors hover:text-fg"
                  >
                    {channel.email}
                  </a>
                </li>
              ))}
            </ul>

            <div className="mt-[22px] rounded-[18px] border border-line-2 bg-surface p-[22px]">
              <p className="text-[11px] font-semibold tracking-[0.16em] text-accent uppercase">Enterprise</p>
              <h2 className="mt-3 text-[22px] font-bold tracking-[-0.03em]">What a rollout includes</h2>
              <ul className="mt-4 flex flex-col gap-[11px]">
                {ENTERPRISE_INCLUDES.map((item) => (
                  <Bullet key={item} className="gap-[11px] text-sm leading-normal text-fg-2" dotClassName="mt-1.5">
                    {item}
                  </Bullet>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-[22px] border border-line-2 bg-card p-[clamp(22px,2.6vw,34px)] shadow-[0_40px_90px_-60px_rgba(0,0,0,0.95)]">
            <ContactForm />
          </div>
        </div>
      </section>

      <section className="border-t border-line bg-bg-2 px-gutter py-[clamp(48px,7vw,90px)]">
        <div className="mx-auto max-w-[1180px]">
          <h2 className="text-[clamp(26px,3.4vw,40px)] leading-[1.08] font-extrabold tracking-[-0.035em]">
            What happens next
          </h2>
          <ol className="mt-[30px] grid grid-cols-[repeat(auto-fit,minmax(min(230px,100%),1fr))] gap-3.5">
            {NEXT_STEPS.map((step, i) => (
              <li key={step.title} className="rounded-[18px] border border-line-2 bg-surface p-[22px]">
                <p aria-hidden className="text-[11px] font-semibold tracking-[0.16em] text-accent">
                  0{i + 1}
                </p>
                <h3 className="mt-3 text-[17px] font-bold tracking-[-0.025em]">{step.title}</h3>
                <p className="mt-2 text-sm leading-[1.55] text-pretty text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
