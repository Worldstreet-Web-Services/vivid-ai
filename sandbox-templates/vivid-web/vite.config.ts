import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";


// Stamps each JSX element with "file:line:column" while the dev server is
// running, so the builder's visual editor can map a click in the preview
// back to one exact span of source. Never in a production build.
function vividSourceLocation({ types: t }) {
  return {
    name: "vivid-source-location",
    visitor: {
      JSXOpeningElement(path, state) {
        if (process.env.NODE_ENV === "production") return;
        const node = path.node;
        if (!node.loc) return;
        const file = String(state.filename || "");
        const root = String(state.cwd || "");
        const rel = file.startsWith(root) ? file.slice(root.length + 1) : file;
        if (!rel.startsWith("src/")) return;
        for (const attr of node.attributes) {
          if (attr.name && attr.name.name === "data-vivid-loc") return;
        }
        node.attributes.unshift(
          t.jsxAttribute(
            t.jsxIdentifier("data-vivid-loc"),
            t.stringLiteral(rel + ":" + node.loc.start.line + ":" + node.loc.start.column)
          )
        );
      },
    },
  };
}
// Behind the E2B proxy the page is served over https on port 443, so the HMR
// websocket must be told to connect there rather than to :5173. The start
// script sets VIVID_SANDBOX=e2b; locally the default (same port) is right.
const behindProxy = process.env.VIVID_SANDBOX === "e2b";

export default defineConfig({
  plugins: [react({ babel: { plugins: [vividSourceLocation] } }), tailwindcss()],
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
