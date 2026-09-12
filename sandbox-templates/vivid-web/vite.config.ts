import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Behind the E2B proxy the page is served over https on port 443, so the HMR
// websocket must be told to connect there rather than to :5173. The start
// script sets VIVID_SANDBOX=e2b; locally the default (same port) is right.
const behindProxy = process.env.VIVID_SANDBOX === "e2b";

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
