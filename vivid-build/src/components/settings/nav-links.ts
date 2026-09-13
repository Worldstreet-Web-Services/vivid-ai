import type { PlanTier } from "@/components/ui/plan-badge";

export type SettingsLink = {
  href: string;
  label: string;
  /** Locked behind a plan. Still listed — seeing what exists is half the point. */
  tier?: PlanTier;
  /** Carries the ?project= scope when navigated to. */
  projectScoped?: boolean;
};

export type SettingsGroup = { heading: string | null; links: SettingsLink[] };

export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    heading: null,
    links: [
      { href: "/settings/account", label: "Account" },
      { href: "/settings/devices", label: "Devices & apps" },
    ],
  },
  {
    heading: "Project",
    links: [
      { href: "/settings/project/general", label: "General", projectScoped: true },
      { href: "/settings/project/connectors", label: "Connectors", projectScoped: true },
      { href: "/settings/project/git", label: "Git", projectScoped: true },
      { href: "/settings/project/domains", label: "Domains", projectScoped: true },
    ],
  },
  {
    heading: "Workspace",
    links: [
      { href: "/settings/workspace", label: "Workspace" },
      { href: "/settings/billing", label: "Plans & credit usage" },
      { href: "/settings/appearance", label: "Appearance" },
    ],
  },
  {
    heading: "Access",
    links: [
      { href: "/settings/people", label: "People" },
      { href: "/settings/groups", label: "Groups", tier: "Business" },
      { href: "/settings/identity", label: "Identity", tier: "Business" },
    ],
  },
  {
    heading: "Customization",
    links: [
      { href: "/settings/knowledge", label: "Knowledge", projectScoped: true },
      { href: "/settings/skills", label: "Skills" },
      { href: "/settings/templates", label: "Templates", tier: "Business" },
    ],
  },
  {
    heading: "Build & deploy",
    links: [
      { href: "/settings/mcp", label: "MCP server" },
      { href: "/settings/api-keys", label: "API keys" },
      { href: "/settings/build-secrets", label: "Build secrets", tier: "Enterprise" },
    ],
  },
  {
    heading: "Security",
    links: [{ href: "/settings/privacy", label: "Privacy & security" }],
  },
];

/** Filters by label, keeping a group heading only when it still has matches. */
export function filterGroups(groups: SettingsGroup[], query: string): SettingsGroup[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return groups;
  return groups
    .map((group) => ({ ...group, links: group.links.filter((link) => link.label.toLowerCase().includes(needle)) }))
    .filter((group) => group.links.length > 0);
}
