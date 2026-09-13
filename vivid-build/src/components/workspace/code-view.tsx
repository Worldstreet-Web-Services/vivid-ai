"use client";

import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { TOKEN_CLASS, tokenize, type FileLanguage, type Token } from "@/lib/highlight";

type Props = {
  content: string;
  language: FileLanguage;
  wrap: boolean;
  fontSize: number;
};

/** Splits the token stream into lines so each one can carry a gutter number. */
function toLines(tokens: Token[]): Token[][] {
  const lines: Token[][] = [[]];
  for (const token of tokens) {
    const parts = token.text.split("\n");
    parts.forEach((part, index) => {
      if (index > 0) lines.push([]);
      if (part) lines[lines.length - 1].push({ text: part, type: token.type });
    });
  }
  return lines;
}

export function CodeView({ content, language, wrap, fontSize }: Props) {
  const lines = useMemo(() => toLines(tokenize(content, language)), [content, language]);

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <pre
        className="w-fit min-w-full font-mono leading-[1.7] text-fg-2"
        style={{ fontSize: `${fontSize}px` }}
      >
        <code className="grid grid-cols-[auto_1fr] items-start">
          {lines.map((line, index) => (
            // Lines have no identity of their own; the index is the identity.
             
            <div key={index} className="group contents">
              <span
                aria-hidden
                className="sticky left-0 z-1 select-none border-r border-line bg-surface px-3 text-right tabular-nums text-muted-3/70"
              >
                {index + 1}
              </span>
              <span className={cn("pr-4 pl-3.5", wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre")}>
                {line.length === 0 ? (
                  " "
                ) : (
                  line.map((token, position) => (
                     
                    <span key={position} className={TOKEN_CLASS[token.type]}>
                      {token.text}
                    </span>
                  ))
                )}
              </span>
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
}
