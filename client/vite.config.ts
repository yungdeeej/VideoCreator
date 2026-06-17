import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const BACKEND = process.env.BACKEND_URL || "http://localhost:8787";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: BACKEND, changeOrigin: true },
      "/assets": { target: BACKEND, changeOrigin: true },
      "/exports": { target: BACKEND, changeOrigin: true },
    },
    // allow importing the @storyforge/shared workspace package (outside root)
    fs: { allow: [".."] },
  },
});
