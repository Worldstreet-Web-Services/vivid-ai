import Link from "next/link";
import { buttonClass } from "@/lib/ui";
import { PageHeader } from "./page-header";
import { SettingsSection } from "./settings-section";

/**
 * A page whose feature the builder API does not expose yet.
 *
 * Deliberately not `LockedPage`: this is not gated behind a plan, and dressing
 * a missing endpoint up as an upsell would be a lie. It says what is missing
 * and points at the thing that does work today.
 */
export function NotAvailable({
  title,
  description,
  body,
  instead,
}: {
  title: string;
  description: string;
  body: string;
  instead?: { label: string; href: string };
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <SettingsSection
        title="Not wired up yet"
        description={body}
        footer={
          instead ? (
            <Link href={instead.href} className={buttonClass({ variant: "secondary", size: "sm" })}>
              {instead.label}
            </Link>
          ) : undefined
        }
      >
        <span className="sr-only">This settings page has no backend behind it yet.</span>
      </SettingsSection>
    </>
  );
}
