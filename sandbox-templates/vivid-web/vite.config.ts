import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";


// vivid:loc-plugin
// Gives the builder's visual editor an anchor: while the dev server runs,
// every element carries the file, line and column it was written at. The
// dev JSX runtime already knows that (it is what React DevTools shows), so
// this wraps it rather than parsing anything. `apply: "serve"` keeps it out
// of every production build.
function vividSourceLocation() {
  const VIRTUAL = String.fromCharCode(0) + "vivid-jsx-dev";
  const REAL = "react/jsx-dev-runtime";
  return {
    name: "vivid-source-location",
    enforce: "pre",
    apply: "serve",
    resolveId(source, importer) {
      if (source !== REAL || importer === VIRTUAL) return null;
      return VIRTUAL;
    },
    load(id) {
      if (id !== VIRTUAL) return null;
      return [
        'import * as runtime from "' + REAL + '";',
        "export const Fragment = runtime.Fragment;",
        "export function jsxDEV(type, props, key, isStatic, source, self) {",
        "  if (source && typeof source.fileName === 'string') {",
        "    const at = source.fileName.lastIndexOf('/src/');",
        "    if (at !== -1) {",
        "      const where = source.fileName.slice(at + 1) + ':' + source.lineNumber",
        "        + ':' + (source.columnNumber - 1);",
        "      props = Object.assign({ 'data-vivid-loc': where }, props);",
        "    }",
        "  }",
        "  return runtime.jsxDEV(type, props, key, isStatic, source, self);",
        "}",
      ].join(String.fromCharCode(10));
    },
  };
}
// /vivid:loc-plugin


// Behind the E2B proxy the page is served over https on port 443, so the HMR
// websocket must be told to connect there rather than to :5173. The start
// script sets VIVID_SANDBOX=e2b; locally the default (same port) is right.
const behindProxy = process.env.VIVID_SANDBOX === "e2b";

export default defineConfig({
  plugins: [vividSourceLocation(), react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    hmr: behindProxy ? { clientPort: 443, protocol: "wss" } : undefined,
  },
});
