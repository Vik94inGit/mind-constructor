import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Lists every built file in asset-list.json, so the service worker
// (public/sw.js) can keep the pages that load on demand too, not only what
// index.html links — otherwise a map never opened online couldn't open offline.
function assetList(): Plugin {
  return {
    name: "asset-list",
    apply: "build",
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle)
        .filter((f) => f.startsWith("assets/"))
        .map((f) => `/${f}`);
      this.emitFile({ type: "asset", fileName: "asset-list.json", source: JSON.stringify(files) });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), assetList()],
  server: {
    // 5173 for a plain `npm run dev`, but the launch harness assigns a free
    // port via PORT when 5173 is already taken by something else (see
    // .claude/launch.json's "autoPort") — respect that instead of always
    // hardcoding 5173, so a stale process squatting on it doesn't block
    // starting a preview.
    port: Number(process.env.PORT) || 5173,
  },
});
