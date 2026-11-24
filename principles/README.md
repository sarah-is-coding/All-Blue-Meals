# Principles

One file per language or framework this product uses. Each file lists the
principles to follow when writing code with that tool, why each one matters,
and how it applies in this repo. They were researched from official docs and
maintainer guidance (sources are at the bottom of each file).

These files add to [CLAUDE.md](../CLAUDE.md) and [AGENTS.md](../AGENTS.md)
and don't replace them. If a principle here conflicts with a project rule in
those files, the project rule wins.

| File | Covers |
|---|---|
| [typescript.md](typescript.md) | TypeScript 5.9 in strict mode |
| [react.md](react.md) | React 19 components, state, and effects |
| [react-router.md](react-router.md) | React Router v7 (declarative mode) |
| [tanstack-query.md](tanstack-query.md) | TanStack Query v5 server state |
| [supabase-postgres.md](supabase-postgres.md) | Postgres schema, migrations, RLS, and the supabase-js client |
| [supabase-edge-functions.md](supabase-edge-functions.md) | Deno edge functions (`supabase/functions/`) |
| [vite.md](vite.md) | Vite 7 build, env variables, and module layout |
| [css.md](css.md) | Plain CSS with custom properties, mobile-first |
| [testing.md](testing.md) | Vitest 4 + React Testing Library |

## How to use them

- Read the file for every tool a change touches before starting it.
- In review, cite the principle by file and heading (for example,
  `react.md → Don't sync state in effects`).
- When a library major version changes, check its file against the new docs
  and update it in the same PR.
