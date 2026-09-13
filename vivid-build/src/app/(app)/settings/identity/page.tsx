import type { Metadata } from "next";
import { LockedPage } from "@/components/settings/locked-page";

export const metadata: Metadata = { title: "Identity" };

export default function IdentityPage() {
  return (
    <LockedPage
      title="Identity"
      tier="Business"
      description="Single sign-on and automated provisioning for your whole organisation."
      points={[
        "SAML single sign-on with your existing provider",
        "SCIM provisioning, so leavers lose access automatically",
        "Enforced two-factor authentication across the workspace",
      ]}
    />
  );
}
