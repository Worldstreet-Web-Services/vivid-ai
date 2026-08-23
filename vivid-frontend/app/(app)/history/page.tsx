import type { Metadata } from "next";

import { HISTORY, HistoryView } from "@/features/history";

export const metadata: Metadata = { title: "History" };

export default function HistoryPage() {
  return <HistoryView entries={HISTORY} />;
}
