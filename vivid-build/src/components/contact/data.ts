export const CONTACT_TOPICS = ["Enterprise rollout", "Onchain project", "Sales question", "Security review"] as const;

export const TEAM_SIZES = ["1 to 9", "10 to 49", "50 to 249", "250 plus"] as const;

export const CONTACT_CHANNELS = [
  { title: "Sales", body: "Plans, rollouts, procurement", email: "sales@vividbuild.dev" },
  { title: "Support", body: "Existing projects and builds", email: "help@vividbuild.dev" },
  { title: "Security", body: "Disclosures and audits", email: "security@vividbuild.dev" },
  { title: "Onchain", body: "Ark-Konstellation deployments", email: "chain@vividbuild.dev" },
] as const;

export const ENTERPRISE_INCLUDES = [
  "Unlimited seats with SSO and SCIM provisioning",
  "Private cloud, or your own VPC in any region",
  "A named architect for the first 90 days",
  "Spec review workflow mapped to your approval process",
  "Mainnet deployment policy for Ark-Konstellation projects",
] as const;

export const NEXT_STEPS = [
  { title: "We read it properly", body: "A person, not a router. If it is technical, an engineer answers." },
  { title: "A 30 minute call", body: "We look at one real workflow you want to replace and scope it live." },
  { title: "A working pilot", body: "You leave with a spec and a deployed pilot, usually inside a week." },
] as const;
