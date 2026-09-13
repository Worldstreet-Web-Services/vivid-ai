import type { Metadata } from "next";
import { DashboardComposer } from "@/components/app/dashboard-composer";
import { DashboardGreeting } from "@/components/app/dashboard-greeting";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    // `overflow-hidden` here used to clip anything taller than the viewport,
    // which on a phone meant the template cards were simply unreachable. The
    // glow does its own clipping instead, and `my-auto` keeps the content
    // centred when it fits without preventing a scroll when it doesn't.
    <div className="relative flex min-h-full flex-col items-center px-5 py-8 sm:px-6">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="absolute inset-x-0 -bottom-[260px] block h-[560px] bg-[radial-gradient(60%_60%_at_50%_100%,var(--glow),transparent)]" />
      </div>
      <div className="relative my-auto w-full max-w-[720px] text-center">
        <DashboardGreeting />
        <DashboardComposer />
      </div>
    </div>
  );
}
