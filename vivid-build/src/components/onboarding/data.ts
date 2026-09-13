import {
  Briefcase,
  Building2,
  Code2,
  Compass,
  Globe,
  Megaphone,
  PenTool,
  Rocket,
  Shapes,
  User,
  Users,
  Workflow,
} from "lucide-react";

export const ONBOARDING_STORAGE_KEY = "vb-onboarding";

export const ONBOARDING_STEPS = [
  { key: "you", title: "What should we call you?", body: "It shows up on your dashboard and in your team." },
  { key: "style", title: "Pick your style", body: "You can switch anytime from the command bar." },
] as const;

export const STYLE_OPTIONS = [
  {
    theme: "light",
    label: "Light",
    canvas: "bg-[#f4f5f8]",
    bar: "bg-[#d8dce4]",
    panel: "bg-[#e8ebf0]",
    mark: "bg-[#9faab9]",
  },
  {
    theme: "dark",
    label: "Dark",
    canvas: "bg-[#15181d]",
    bar: "bg-[#262b33]",
    panel: "bg-[#1d2229]",
    mark: "bg-[#5c6673]",
  },
] as const;

/** Each role gets the icon of the work it does, not an abstract shape. */
export const ROLES = [
  { label: "Founder", Icon: Rocket },
  { label: "Product", Icon: Compass },
  { label: "Designer", Icon: PenTool },
  { label: "Engineer", Icon: Code2 },
  { label: "Consultant", Icon: Briefcase },
  { label: "Marketing", Icon: Megaphone },
  { label: "Operations", Icon: Workflow },
  { label: "Other", Icon: Shapes },
] as const;

export const COMPANY_SIZES = [
  { label: "Solo", hint: "Just me", Icon: User },
  { label: "2 to 20", hint: "Small team", Icon: Users },
  { label: "21 to 200", hint: "Scaling up", Icon: Building2 },
  { label: "200 plus", hint: "Enterprise", Icon: Globe },
] as const;
