/** What the tokenizer understands. Derived from the path, since the API sends none. */
export type FileLanguage = "tsx" | "ts" | "css" | "html" | "md" | "json";

const BY_EXTENSION: Record<string, FileLanguage> = {
  tsx: "tsx",
  ts: "ts",
  js: "ts",
  jsx: "tsx",
  css: "css",
  html: "html",
  md: "md",
  json: "json",
};

export function languageFor(path: string): FileLanguage {
  return BY_EXTENSION[path.slice(path.lastIndexOf(".") + 1).toLowerCase()] ?? "ts";
}

/**
 * A small syntax highlighter.
 *
 * The generated files are the only thing that ever gets highlighted, so this
 * deliberately stops well short of a real parser: one pass of sticky regexes
 * per language, first match wins. Anything it doesn't recognise stays plain,
 * which is the right failure mode for a viewer.
 */
export type TokenType =
  | "plain"
  | "comment"
  | "string"
  | "number"
  | "keyword"
  | "type"
  | "fn"
  | "tag"
  | "attr"
  | "prop"
  | "punct";

export type Token = { text: string; type: TokenType };

type Rule = { type: TokenType; re: RegExp };

const KEYWORDS =
  /^(?:import|export|from|default|const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|class|extends|implements|interface|type|enum|typeof|instanceof|in|of|as|await|async|yield|try|catch|finally|throw|delete|void|this|super|static|public|private|protected|readonly|declare|satisfies|null|undefined|true|false|pragma|contract|mapping|address|uint256|memory|storage|require|emit|event|constructor|modifier|external|internal|view|returns)$/;

/** Shared by ts/tsx and the Solidity file, which is close enough to C-family. */
const SCRIPT_RULES: Rule[] = [
  { type: "comment", re: /\/\/[^\n]*|\/\*[\s\S]*?\*\//y },
  { type: "string", re: /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/y },
  { type: "number", re: /\b(?:0[xX][\da-fA-F]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/y },
  { type: "tag", re: /<\/?[A-Za-z][\w.]*|\/?>/y },
  { type: "fn", re: /[A-Za-z_$][\w$]*(?=\s*\()/y },
  { type: "type", re: /[A-Z][\w$]*/y },
  { type: "keyword", re: /[A-Za-z_$][\w$]*/y },
  { type: "punct", re: /[{}()[\];,.:?!<>=+\-*/%&|^~]+/y },
];

const CSS_RULES: Rule[] = [
  { type: "comment", re: /\/\*[\s\S]*?\*\//y },
  { type: "string", re: /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/y },
  { type: "keyword", re: /@[\w-]+/y },
  { type: "prop", re: /[-a-zA-Z][\w-]*(?=\s*:)/y },
  { type: "number", re: /(?:#[\da-fA-F]{3,8}|\b\d*\.?\d+(?:px|rem|em|%|vh|vw|s|ms|deg|fr)?)/y },
  { type: "fn", re: /[\w-]+(?=\()/y },
  { type: "tag", re: /\.[\w-]+|#[\w-]+|\b(?:html|body|a|p|h[1-6]|div|span|ul|li|nav|main|header|footer|section|img|button|input|form|label|table|tr|td|th)\b/y },
  { type: "punct", re: /[{}();:,>+~*]+/y },
];

const HTML_RULES: Rule[] = [
  { type: "comment", re: /<!--[\s\S]*?-->|<!doctype[^>]*>/iy },
  { type: "string", re: /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/y },
  { type: "tag", re: /<\/?[\w-]+|\/?>/y },
  { type: "attr", re: /[-a-zA-Z:@][\w-:.]*(?=\s*=)/y },
  { type: "punct", re: /=/y },
];

const MD_RULES: Rule[] = [
  { type: "comment", re: /^>[^\n]*/my },
  { type: "keyword", re: /^#{1,6}[^\n]*/my },
  { type: "string", re: /`[^`\n]*`|```[\s\S]*?```/y },
  { type: "type", re: /\*\*[^*\n]+\*\*|_[^_\n]+_/y },
  { type: "tag", re: /^\s*(?:[-*+]|\d+\.)\s/my },
  { type: "fn", re: /\[[^\]\n]*\]\([^)\n]*\)/y },
];

const JSON_RULES: Rule[] = [
  { type: "prop", re: /"(?:[^"\\\n]|\\.)*"(?=\s*:)/y },
  { type: "string", re: /"(?:[^"\\\n]|\\.)*"/y },
  { type: "number", re: /-?\d[\d.eE+-]*/y },
  { type: "keyword", re: /\b(?:true|false|null)\b/y },
  { type: "punct", re: /[{}[\],:]+/y },
];

const RULES: Record<FileLanguage, Rule[]> = {
  tsx: SCRIPT_RULES,
  ts: SCRIPT_RULES,
  css: CSS_RULES,
  html: HTML_RULES,
  md: MD_RULES,
  json: JSON_RULES,
};

export function tokenize(code: string, language: FileLanguage): Token[] {
  const rules = RULES[language] ?? SCRIPT_RULES;
  const tokens: Token[] = [];
  let plain = "";
  let index = 0;

  const flush = () => {
    if (plain) tokens.push({ text: plain, type: "plain" });
    plain = "";
  };

  while (index < code.length) {
    let matched = false;

    for (const rule of rules) {
      rule.re.lastIndex = index;
      const match = rule.re.exec(code);
      if (!match || match[0] === "") continue;

      // `keyword` is the catch-all identifier rule; anything not in the list is
      // an ordinary name and should stay plain.
      const type = rule.type === "keyword" && rules === SCRIPT_RULES && !KEYWORDS.test(match[0]) ? null : rule.type;
      if (type === null) {
        plain += match[0];
      } else {
        flush();
        tokens.push({ text: match[0], type });
      }
      index += match[0].length;
      matched = true;
      break;
    }

    if (!matched) {
      plain += code[index];
      index += 1;
    }
  }

  flush();
  return tokens;
}

export const TOKEN_CLASS: Record<TokenType, string> = {
  plain: "",
  comment: "text-code-comment italic",
  string: "text-code-string",
  number: "text-code-number",
  keyword: "text-code-keyword",
  type: "text-code-type",
  fn: "text-code-fn",
  tag: "text-code-tag",
  attr: "text-code-attr",
  prop: "text-code-prop",
  punct: "text-code-punct",
};
