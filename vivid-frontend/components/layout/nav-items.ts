import {
  ArtifactsIcon,
  ComputerIcon,
  CustomizeIcon,
  HistoryIcon,
  PlusIcon,
  SpacesIcon,
} from "@/components/ui/icons";

export interface NavItem {
  label: string;
  href: string;
  icon: (props: { size?: number; className?: string }) => React.ReactNode;
}

// The sidebar rail. Declared once so the sidebar and any future command menu
// stay in step. Routes that do not exist yet still belong here: the design
// includes them, and a missing page is a clearer gap than a missing link.
export const sidebarNav: NavItem[] = [
  { label: "New", href: "/", icon: PlusIcon },
  { label: "Computer", href: "/computer", icon: ComputerIcon },
  { label: "Spaces", href: "/spaces", icon: SpacesIcon },
  { label: "Artifacts", href: "/artifacts", icon: ArtifactsIcon },
  { label: "Customize", href: "/customize", icon: CustomizeIcon },
  { label: "History", href: "/history", icon: HistoryIcon },
];

// The discovery categories across the top of the workspace.
export const topicNav: { label: string; href: string }[] = [
  { label: "Discover", href: "/discover" },
  { label: "Finance", href: "/finance" },
  { label: "Health", href: "/health" },
  { label: "Academic", href: "/academic" },
  { label: "Patents", href: "/patents" },
];
