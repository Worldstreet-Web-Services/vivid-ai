/**
 * Files whose bytes are not text.
 *
 * The files endpoint returns `{path, content}` as JSON for everything, so a
 * JPEG comes back as mojibake and the syntax highlighter renders it as pages of
 * replacement characters. Anything listed here is never fetched as text.
 */
const BINARY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "avif", "ico", "bmp", "tiff",
  "woff", "woff2", "ttf", "otf", "eot",
  "mp4", "webm", "mov", "mp3", "wav", "ogg", "flac",
  "pdf", "zip", "gz", "tar", "br", "wasm", "db", "sqlite",
]);

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "avif", "ico", "bmp", "svg"]);

export function extensionOf(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot === -1 ? "" : path.slice(dot + 1).toLowerCase();
}

/** SVG is text and highlights fine, so it is deliberately not in the binary set. */
export function isBinaryPath(path: string): boolean {
  return BINARY_EXTENSIONS.has(extensionOf(path));
}

export function isImagePath(path: string): boolean {
  return IMAGE_EXTENSIONS.has(extensionOf(path));
}

/** Bytes that survived a UTF-8 decode as replacement characters. */
export function looksBinary(content: string): boolean {
  if (!content) return false;
  const sample = content.slice(0, 2000);
  let replacements = 0;
  for (const character of sample) {
    if (character === "�" || (character < " " && character !== "\n" && character !== "\r" && character !== "\t")) {
      replacements += 1;
    }
  }
  return replacements / sample.length > 0.05;
}
