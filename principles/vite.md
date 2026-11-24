# Vite principles

Applies to: Vite 7 with `@vitejs/plugin-react`, deployed as a static SPA
(`vercel.json`). `vite.config.ts` also holds the Vitest config.

## 1. Everything in `VITE_*` is public

- Vite inlines `import.meta.env.VITE_*` values into the shipped JavaScript,
  so anyone can read them. Only the Supabase URL and anon key belong there.
  Server secrets (service role key, Gemini key) go in edge function secrets
  (see [supabase-edge-functions.md](supabase-edge-functions.md)).
- Read env variables in one place (`src/lib/supabaseClient.ts`) and fail
  fast with a clear message when one is missing. To type a new one, declare
  it on `ImportMetaEnv` in a `src/vite-env.d.ts` (create it the first time
  it's needed; `vite/client` types come from `tsconfig.app.json`).
- `.env` files stay out of git. Tests use the placeholder values in
  `vite.config.ts` → `test.env`.

## 2. Keep the module graph cheap

- Import from the file that defines a thing, not through barrel `index.ts`
  files that re-export a whole folder. A barrel makes Vite load and
  transform every file it re-exports, slowing dev server start, HMR, and
  tests. The one sanctioned exception is a feature's `api/index.ts` (CLAUDE.md
  → Feature Structure).
- Avoid import-time side effects, so modules can be loaded in any order and
  tree-shaken.
- Use explicit file extensions only where TypeScript needs them; let the
  bundler resolve the rest (`moduleResolution: "bundler"`).

## 3. Watch what ships to phones

- The app is mobile-first, so bundle size is a UX feature. Before adding a
  dependency, check its size and whether the platform already does the job
  (`Intl` for dates and numbers, `fetch`, CSS for animation).
- Split large, rarely used pages with dynamic `import()` / `React.lazy`
  (see [react-router.md](react-router.md)).
- Put static files that need a fixed URL in `public/`. Import everything
  else (images, CSS) from source so Vite fingerprints it for caching.

## 4. Keep config small and the build the check

- Prefer Vite's defaults; every config option needs a reason in a comment.
- `npm run build` runs `tsc -b` first because Vite only strips types and
  never type-checks. Run it before finishing any change (CLAUDE.md → Test
  scripts).
- Use `vite preview` to check the production build locally (routing
  fallbacks, env values) before deploying a build-related change.

## 5. Fast refresh friendliness

- A file that exports React components should export only components
  (`eslint-plugin-react-refresh` enforces this). Move constants, hooks, and
  helpers to their own files so editing them doesn't force a full reload.

## Sources

- [Vite: Env Variables and Modes](https://vite.dev/guide/env-and-mode)
- [Vite: Performance (avoid barrel files)](https://vite.dev/guide/performance)
- [Vite: Static Asset Handling](https://vite.dev/guide/assets)
- [Atlassian: Faster builds when removing barrel files](https://www.atlassian.com/blog/atlassian-engineering/faster-builds-when-removing-barrel-files)
