import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Libraries go in their own chunks. They change far less often than
        // the app, so after a deploy returning phones re-download only the
        // app's code (~25 kB gzipped) instead of everything (~155 kB).
        // Measured 2026-11-24: react-dom ~55 kB gz, the Supabase client
        // ~44 kB gz, TanStack Query + React Router ~23 kB gz.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (/node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) {
            return "vendor-react";
          }
          if (/node_modules[\\/](@supabase|tslib)[\\/]/.test(id)) return "vendor-supabase";
          return "vendor";
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/__tests__/setup.ts"],
    exclude: ["node_modules", "dist"],
    // Tests never use the real Supabase project from .env. These placeholders
    // let modules that create the client load (CI has no .env), and point
    // anything a test forgot to mock at an address that doesn't exist.
    env: {
      VITE_SUPABASE_URL: "http://supabase.test.invalid",
      VITE_SUPABASE_ANON_KEY: "test-anon-key",
    },
  },
});
