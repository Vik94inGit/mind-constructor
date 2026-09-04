import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // 5173 for a plain `npm run dev`, but the launch harness assigns a free
    // port via PORT when 5173 is already taken by something else (see
    // .claude/launch.json's "autoPort") — respect that instead of always
    // hardcoding 5173, so a stale process squatting on it doesn't block
    // starting a preview.
    port: Number(process.env.PORT) || 5173,
  },
});
