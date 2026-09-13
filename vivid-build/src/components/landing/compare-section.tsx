import { AuthButton } from "@/components/auth/auth-button";
import { Reveal } from "@/components/ui/reveal";
import { buttonClass } from "@/lib/ui";
import { COMPARE_ROWS } from "./data";

// Below `sm` each row stacks: the capability spans the full width above the two answers.
const rowGrid = "grid grid-cols-2 sm:grid-cols-[1.6fr_1fr_1fr]";
const cellPadding = "px-4 py-3 sm:px-5 sm:py-[18px]";

export function CompareSection() {
  return (
    <section id="compare" className="px-gutter py-[clamp(72px,10vw,130px)]">
      <div className="mx-auto max-w-[1000px]">
        <Reveal
          as="h2"
          className="mt-3.5 max-w-[640px] text-[clamp(30px,4vw,50px)] leading-[1.06] font-extrabold tracking-[-0.035em]"
        >
          Most builders stop at the demo.
        </Reveal>
        <p className="mt-4 max-w-[540px] text-base leading-[1.6] text-muted">
          Where the prototype ends is where the work starts. Here is what changes hands when you move to VividBuild.
        </p>

        <div
          role="table"
          aria-label="VividBuild compared with a typical AI builder"
          className="mt-[38px] overflow-hidden rounded-[18px] border border-line-2"
        >
          <div role="row" className={`${rowGrid} bg-surface-2`}>
            <div
              role="columnheader"
              className="hidden px-5 py-4 text-[11px] font-semibold tracking-[0.1em] text-muted-2 uppercase sm:block"
            >
              Capability
            </div>
            <div
              role="columnheader"
              className="bg-[linear-gradient(180deg,var(--fg),var(--fg2))] px-4 py-4 text-sm font-bold text-btn-fg sm:px-5"
            >
              VividBuild
            </div>
            <div role="columnheader" className="px-4 py-4 text-sm font-medium text-muted sm:px-5">
              Typical AI builder
            </div>
          </div>
          {COMPARE_ROWS.map((row) => (
            <div key={row.feature} role="row" className={`${rowGrid} border-t border-line`}>
              <div
                role="rowheader"
                className="col-span-2 px-4 pt-4 pb-1 text-[15px] font-medium text-fg sm:col-span-1 sm:px-5 sm:py-[18px]"
              >
                {row.feature}
              </div>
              <div role="cell" className={`bg-tint text-sm text-fg ${cellPadding}`}>
                {row.us}
              </div>
              <div role="cell" className={`text-sm text-muted-3 ${cellPadding}`}>
                {row.them}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-[26px] flex flex-wrap items-center gap-3.5">
          <AuthButton magnetic className={buttonClass()}>
            Start building free
          </AuthButton>
          <span className="text-sm text-muted">Free tier, no card. Code export from Pro upwards.</span>
        </div>
      </div>
    </section>
  );
}
