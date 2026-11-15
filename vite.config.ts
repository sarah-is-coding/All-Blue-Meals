import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
