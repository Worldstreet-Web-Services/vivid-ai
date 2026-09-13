import type { Metadata } from "next";
import { PeopleSettings } from "@/components/settings/people-settings";

export const metadata: Metadata = { title: "People" };

export default function PeoplePage() {
  return <PeopleSettings />;
}
