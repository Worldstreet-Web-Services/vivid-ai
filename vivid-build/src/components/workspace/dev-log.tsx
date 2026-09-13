"use client";

import { Fragment } from "react";
import { cn } from "@/lib/cn";

/**
 * The dev server's output, coloured the way a terminal would.
 *
 * Vite's own ANSI codes do not survive the API, so the colour is reconstructed
 * here from the shapes its output actually takes. It reuses the `--code-*`
 * tokens rather than inventing a second palette, so the logs and the code
 * viewer read as the same surface.
 */

/** Belt and braces: if escapes ever do come through, they must not render raw. */
// Built rather than written as a literal: a raw ESC byte in source is
// invisible in every editor and diff it passes through.
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

type Rule = { re: RegExp; className: string };

const RULES: Rule[] = [
  // http://… — the thing people actually want to click out of a log.
  { re: /https?:\/\/[^\s)]+/y, className: "text-code-string underline underline-offset-2" },
  // 11:36:59 AM
  { re: /^\d{1,2}:\d{2}:\d{2}(?:\s?[AP]M)?/iy, className: "text-muted-3" },
  // [vite], [plugin:foo]
  { re: /\[[^\]\s]+\]/y, className: "text-code-keyword" },
  // (client), (server)
  { re: /\([a-z-]+\)/y, className: "text-code-type" },
  // /src/pages/Deal.tsx
  { re: /(?:\.\/|\/)[\w./-]*\.\w{1,5}\b/y, className: "text-code-attr" },
  // 504 ms, v8.3.0, :5173
  { re: /\bv?\d+(?:\.\d+)*(?:\s?ms|\s?s)?\b/y, className: "text-code-number" },
  { re: /\b(?:ready|built|compiled|success|done|ok)\b/iy, className: "text-code-string" },
  { re: /\b(?:error|failed|failure|cannot|not found|ENOENT)\b/iy, className: "font-semibold text-warn" },
  { re: /\b(?:warn|warning|deprecated)\b/iy, className: "text-code-number" },
  { re: /➜|→|»/y, className: "text-accent" },
];

function tokenize(line: string) {
  const tokens: { text: string; className: string }[] = [];
  let plain = "";
  let index = 0;

  const flush = () => {
    if (plain) tokens.push({ text: plain, className: "" });
    plain = "";
  };

  while (index < line.length) {
    let matched = false;
    for (const rule of RULES) {
      rule.re.lastIndex = index;
      const match = rule.re.exec(line);
      if (!match || !match[0]) continue;
      flush();
      tokens.push({ text: match[0], className: rule.className });
      index += match[0].length;
      matched = true;
      break;
    }
    if (!matched) {
      plain += line[index];
      index += 1;
    }
  }

  flush();
  return tokens;
}

export function DevLog({ lines, className }: { lines: string[]; className?: string }) {
  return (
    <pre className={cn("overflow-auto p-3 font-mono text-[11.5px] leading-[1.65] text-muted-2", className)}>
      {lines.map((raw, index) => {
        const line = raw.replace(ANSI, "");
        // An npm lifecycle line ("> vite --host …") is noise around the real output.
        const muted = line.startsWith(">");
        // A whole failing line reads better tinted than word-by-word.
        const failing = /\b(?:error|failed|ENOENT)\b/i.test(line);

        return (
          <div
            key={`${index}-${line}`}
            className={cn(
              "-mx-1 rounded px-1",
              muted && "text-muted-3",
              failing && "bg-warn/15 text-fg-2",
            )}
          >
            {line === "" ? (
              " "
            ) : muted ? (
              line
            ) : (
              tokenize(line).map((token, position) => (
                <Fragment key={position}>
                  {token.className ? <span className={token.className}>{token.text}</span> : token.text}
                </Fragment>
              ))
            )}
          </div>
        );
      })}
    </pre>
  );
}
