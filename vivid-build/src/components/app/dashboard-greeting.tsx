"use client";

import { useSession } from "@/lib/api/session";

/**
 * The name comes from the signed-in account. It is absent for the moment
 * between mount and /auth/me answering, so the greeting drops the name rather
 * than flashing a placeholder one.
 */
export function DashboardGreeting() {
  const { user } = useSession();
  const firstName = user?.name?.trim().split(" ")[0] ?? "";

  return (
    <h1 className="text-[clamp(28px,4vw,44px)] font-extrabold tracking-[-0.045em] text-balance">
      {firstName ? `What are we building, ${firstName}?` : "What are we building?"}
    </h1>
  );
}
