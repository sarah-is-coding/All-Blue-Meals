# Supabase and Postgres principles

Applies to: the Postgres schema in `supabase/migrations/`, RLS policies,
SQL functions, and `@supabase/supabase-js` v2 calls in `api.ts` files. The
migration workflow and table ownership rules are in CLAUDE.md → Supabase and
AGENTS.md → Data + RLS rules. This file covers how to write the SQL and
queries well.

## 1. RLS is the security boundary, so make it correct

- Enable RLS on every table in the same migration that creates it, and
  write a separate policy for each operation (SELECT/INSERT/UPDATE/DELETE)
  with an explicit `to authenticated`. Never rely on the client to filter
  rows for security.
- INSERT and UPDATE policies need `with check`, not just `using`, or a user
  can write a row that belongs to someone else.
- Child tables check ownership through the parent with `exists (select 1
  from recipes r where r.id = recipe_id and r.user_id = (select auth.uid()))`.
- Verify every policy change both ways: the owner can access their rows,
  and another user can't (AGENTS.md → Testing expectations). Run the
  Supabase security advisor (`get_advisors`) after schema changes.

## 2. Write RLS policies that stay fast

- Wrap auth functions in a subselect: `(select auth.uid()) = user_id`, not
  `auth.uid() = user_id`. The subselect is evaluated once per query instead
  of once per row.
- Index every column a policy filters on (`user_id`, parent foreign keys)
  that isn't already a primary key or unique.
- Also filter in the query (`.eq("user_id", userId)` or a date range). RLS
  is for security, and an explicit filter lets Postgres use indexes and
  return less.
- For lookups across tables, prefer `column in (select …)` over a join per
  row. When a check needs to read a table the user can't see, use a
  `security definer` function (see 4).

## 3. Model data so the database enforces the rules

- Use `NOT NULL` for every column the app always sets (CLAUDE.md), and
  `CHECK` constraints for closed value sets and ranges (`meal_type in (…)`,
  `servings > 0`). The database is the last line of defense against bad
  data from any client.
- Use `timestamptz` for points in time (`created_at`) and `date` for
  calendar days (`planned_for`). Never use `timestamp` without a time zone.
- Use `text` with a `CHECK` on length rather than `varchar(n)`.
- Declare foreign keys with an explicit `on delete` (`cascade` for owned
  children such as `recipe_ingredients`, `set null` or `restrict` otherwise).
  Postgres doesn't index the referencing column automatically, so add that
  index yourself.
- Keep rows small and text-first: no images, no large JSON blobs, no
  duplicated content (AGENTS.md → Performance + storage).

## 4. Functions and RPCs

- Default to `security invoker` so RLS still applies. Use
  `security definer` only when the function must do something the user
  can't do directly (like `add_ingredient_alias`), and then:
  - set `search_path = ''` and schema-qualify every name (`public.recipes`),
  - validate every argument and check `auth.uid()` inside the function,
  - `revoke execute … from public, anon` and grant only to `authenticated`.
- Keep business rules that must hold for every client (synonym safety,
  category upgrades) in SQL functions. Keep presentation logic in TypeScript.
- Mark functions `stable` or `immutable` when they are, so the planner can
  optimize calls.

## 5. Migrations are append-only and safe to rerun on a fresh database

- One concern per migration file. Never edit a migration that has been
  applied (CLAUDE.md).
- Write migrations that work on an empty database and on production.
  Backfill existing rows before adding `NOT NULL`, and use
  `if not exists`/`if exists` where it prevents ordering failures.
- Prefer additive changes. Rename or retype a column in steps (add new →
  backfill → switch the app → drop old) so a deployed app version never
  meets a schema it can't read.
- Regenerate `database.types.ts` with `npm run db:types` after applying,
  and commit it with the migration.

## 6. Query from the client efficiently

- Select only the columns a view needs, never `select("*")` for lists.
  Load full records (instructions, ingredients) only on detail pages.
- Fetch related rows in one request with embedded selects
  (`select("id, title, recipe_ingredients(id, quantity)")`) instead of a
  request per row.
- Bound every list query: a date range, `.limit()`, or `.range()` for
  paging.
- Always check `error` before using `data`. Map rows to camelCase types in
  `api.ts` (CLAUDE.md → Code Style).
- Use the single typed client from `src/lib/supabaseClient.ts`
  (`createClient<Database>`). Never create another client, and never ship
  the service role key to the browser.

## 7. Auth

- Read the current user from the session that Supabase manages. Don't
  store tokens yourself. Use `useCurrentUserId()` in components and query
  keys.
- On sign-out, clear the query cache and any per-user remembered state
  (already done in `useSessionCache.ts`).
- Auth error messages shown to users must be friendly and must not reveal
  whether an email is registered.

## Sources

- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase: RLS performance and best practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [Supabase: Row Level Security performance](https://supabase.com/docs/guides/database/postgres/row-level-security-performance)
- [Supabase: Database advisors](https://supabase.com/docs/guides/observability/advisors)
- [Supabase AI prompt: database RLS policies](https://supabase.com/docs/guides/ai-tools/ai-prompts/database-rls-policies)
- [PostgreSQL wiki: Don't Do This](https://wiki.postgresql.org/wiki/Don%27t_Do_This)
- [GitLab: CHECK constraints](https://docs.gitlab.com/development/database/check_constraints/)
- [DEV: Zero-downtime schema changes with Supabase migrations](https://dev.to/kanta13jp1/supabase-migrations-advanced-zero-downtime-schema-changes-in-production-5aai)
