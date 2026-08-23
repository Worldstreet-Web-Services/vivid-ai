"use client";

import { useQuery } from "@tanstack/react-query";

import { findSession } from "@/features/chat/lib/fixtures";
import type { Session } from "@/features/chat/lib/types";

export const sessionQueryKey = (id: string) => ["chat", "session", id] as const;

// Reads a thread. Backed by the local fixture until the chat endpoint exists;
// the query shape is what a real fetch will return, so only the queryFn moves.
export function useSession(id: string) {
  return useQuery<Session | undefined>({
    queryKey: sessionQueryKey(id),
    queryFn: async () => findSession(id),
    staleTime: 60_000,
  });
}
