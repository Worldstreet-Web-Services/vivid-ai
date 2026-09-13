import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/cn";
import { autoFitGrid } from "@/lib/ui";
import { SPEC_STATS } from "./data";
import { SpecTaskList } from "./spec-task-list";

export function SpecsSection() {
  return (
    <section id="specs" className="border-t border-line bg-bg-2 px-gutter py-[clamp(72px,10vw,130px)]">
      <div className={cn("mx-auto grid max-w-[1180px] items-center gap-[clamp(24px,4vw,64px)]", autoFitGrid[300])}>
        <div>
          <Reveal
            as="h2"
            className="mt-3.5 text-[clamp(30px,4vw,50px)] leading-[1.06] font-extrabold tracking-[-0.035em]"
          >
            Vibe coding, with receipts.
          </Reveal>
          <p className="mt-[18px] max-w-[520px] text-[17px] leading-[1.6] text-pretty text-muted">
            Every prompt becomes requirements, a design note and a sequenced task list before a line of code is
            written. Property-based tests then hammer the rules unit tests never check, so “all green” actually means
            it works.
          </p>
          <dl className="mt-[30px] flex flex-wrap gap-7">
            {SPEC_STATS.map((stat) => (
              <div key={stat.label} className="flex flex-col-reverse">
                <dt className="mt-1 text-[13px] text-muted-2">{stat.label}</dt>
                <dd className="text-4xl font-extrabold tracking-[-0.04em] text-fg">{stat.value}</dd>
              </div>
            ))}
          </dl>
          <a
            href="#cta"
            className="mt-[30px] inline-block border-b border-accent pb-0.5 text-[15px] font-semibold text-accent"
          >
            See a real spec →
          </a>
        </div>

        <div className="rounded-[20px] border border-line-2 bg-surface p-[clamp(18px,2vw,26px)]">
          <p className="mb-4 text-[11px] font-semibold tracking-[0.1em] text-muted-2 uppercase">
            spec / checkout-flow.md
          </p>
          <SpecTaskList />
        </div>
      </div>
    </section>
  );
}
