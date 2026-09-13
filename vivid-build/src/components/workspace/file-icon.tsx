import { Braces, FileCode2, FileText, Globe, Hash, Palette } from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/cn";

type IconDef = { Icon: ComponentType<{ className?: string }>; className: string };

/**
 * VS Code tints file icons by type, which is what makes a tree scannable at a
 * glance. Keyed on extension rather than the stored language so a `.sol` file
 * doesn't read as TypeScript.
 */
const BY_EXTENSION: Record<string, IconDef> = {
  tsx: { Icon: FileCode2, className: "text-code-type" },
  ts: { Icon: FileCode2, className: "text-code-keyword" },
  js: { Icon: FileCode2, className: "text-code-fn" },
  json: { Icon: Braces, className: "text-code-attr" },
  css: { Icon: Palette, className: "text-code-prop" },
  html: { Icon: Globe, className: "text-code-tag" },
  md: { Icon: Hash, className: "text-code-string" },
  sol: { Icon: FileCode2, className: "text-code-number" },
};

const FALLBACK: IconDef = { Icon: FileText, className: "text-muted-3" };

export function FileIcon({ name, className }: { name: string; className?: string }) {
  const extension = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  const { Icon, className: tint } = BY_EXTENSION[extension] ?? FALLBACK;
  return <Icon aria-hidden className={cn("size-3.5 flex-none", tint, className)} />;
}
