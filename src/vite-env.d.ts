/// <reference types="vite/client" />

// The environment variables the app reads (principles/vite.md §1). Anything
// prefixed VITE_ is built into the public JavaScript, so only the Supabase
// URL and anon key belong here. Optional, because src/lib/supabaseClient.ts
// checks they're set and explains what's missing.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
