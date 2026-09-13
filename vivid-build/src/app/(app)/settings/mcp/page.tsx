import type { Metadata } from "next";
import { McpSettings } from "@/components/settings/mcp-settings";

export const metadata: Metadata = { title: "MCP server" };

export default function McpPage() {
  return <McpSettings />;
}
