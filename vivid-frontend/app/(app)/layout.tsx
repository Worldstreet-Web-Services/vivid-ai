import { AppShell } from "@/components/layout/app-shell";

// Everything signed in renders inside the shell. Auth lives in its own group
// so it can present full-bleed, without the sidebar or the topic nav.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}
