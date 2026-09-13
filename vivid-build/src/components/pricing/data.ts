export type Plan = {
  name: string;
  price: { monthly: string; yearly: string };
  per: string;
  body: string;
  cta: string;
  features: readonly string[];
  badge?: string;
  featured?: boolean;
};

export const PLANS: readonly Plan[] = [
  {
    name: "Free",
    price: { monthly: "$0", yearly: "$0" },
    per: "forever",
    body: "For trying it out and shipping your first small thing.",
    cta: "Start building",
    features: ["Unlimited specs", "1 live project", "vividbuild.app subdomain", "Hosted preview links", "Community support"],
  },
  {
    name: "Pro",
    price: { monthly: "$32", yearly: "$26" },
    per: "per month",
    badge: "Most picked",
    featured: true,
    body: "For founders and solo builders running real apps in production.",
    cta: "Start 14 day trial",
    features: [
      "Unlimited projects",
      "GitHub code export",
      "Custom domains and SSL",
      "Auth, database and file storage",
      "Payments with Stripe",
      "Preview environment per change",
      "Email support in one day",
    ],
  },
  {
    name: "Team",
    price: { monthly: "$78", yearly: "$62" },
    per: "per seat / month",
    body: "For teams who review each other's specs before anything ships.",
    cta: "Start 14 day trial",
    features: [
      "Everything in Pro",
      "Shared spec review and comments",
      "Roles and permissions",
      "Staging and production environments",
      "Audit log",
      "Priority support in four hours",
    ],
  },
];

export const PLAN_MATRIX = [
  { feature: "Live projects", free: "1", pro: "Unlimited", team: "Unlimited" },
  { feature: "Custom domain", free: "No", pro: "Yes", team: "Yes" },
  { feature: "GitHub export", free: "No", pro: "Yes", team: "Yes, with sync" },
  { feature: "Property based tests", free: "Sample suite", pro: "Full suite", team: "Full suite" },
  { feature: "Environments", free: "Preview only", pro: "Preview and production", team: "Staging added" },
  { feature: "Seats", free: "1", pro: "1", team: "Up to 50" },
  { feature: "Spec review and comments", free: "No", pro: "No", team: "Yes" },
  { feature: "Support", free: "Community", pro: "One business day", team: "Four hours" },
] as const;

export const PRICING_FAQS = [
  {
    q: "What counts as a project?",
    a: "One deployed app with its own spec, database and domain. Drafts and forks you never deploy do not count.",
  },
  { q: "Are there usage credits?", a: "No. Plans are flat monthly. Heavy build days cost the same as quiet ones." },
  {
    q: "Can I switch plans mid month?",
    a: "Yes. Upgrades are prorated immediately, downgrades take effect at the next renewal and keep your projects live until then.",
  },
  {
    q: "What happens to my apps if I downgrade to Free?",
    a: "Export your code before you downgrade, since export is a paid feature. Your apps keep running for 30 days, then projects past the Free limit go read only until you pick which one to keep.",
  },
  {
    q: "Do you offer discounts?",
    a: "Yearly billing saves 20 percent. Students and registered nonprofits get 50 percent off Pro, just write to us from your institution address.",
  },
] as const;

export const ENTERPRISE_IMAGE = {
  src: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1000&q=70&auto=format&fit=crop",
  alt: "Enterprise infrastructure",
};
