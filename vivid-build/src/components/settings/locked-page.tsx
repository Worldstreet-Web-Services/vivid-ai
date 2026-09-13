import Link from "next/link";
import { PlanBadge, type PlanTier } from "@/components/ui/plan-badge";
import { buttonClass } from "@/lib/ui";
import { PageHeader } from "./page-header";
import { SettingsSection } from "./settings-section";

/** Body for a feature the current plan doesn't include. */
export function LockedPage({
  title,
  tier,
  description,
  points,
}: {
  title: string;
  tier: PlanTier;
  description: string;
  points: readonly string[];
}) {
  return (
    <>
      <PageHeader title={title} description={description} action={<PlanBadge tier={tier} />} />
      <SettingsSection
        title={`${title} is on ${tier}`}
        description={`Upgrade to unlock ${title.toLowerCase()} for your whole workspace.`}
        footer={
          <Link href="/settings/billing" className={buttonClass({ size: "sm" })}>
            See plans
          </Link>
        }
        note="Nothing is charged in this prototype."
      >
        <ul className="flex flex-col gap-2.5">
          {points.map((point) => (
            <li key={point} className="flex gap-2.5 text-sm leading-[1.5] text-muted">
              <span aria-hidden className="mt-[7px] block size-1.5 flex-none rounded-full bg-accent" />
              {point}
            </li>
          ))}
        </ul>
      </SettingsSection>
    </>
  );
}
