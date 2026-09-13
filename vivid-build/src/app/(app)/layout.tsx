import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app/app-shell";
import { RequireSession } from "@/components/auth/require-session";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <ToastProvider>
      <RequireSession>
        <AppShell>{children}</AppShell>
      </RequireSession>
    </ToastProvider>
  );
}
