-- Step 2 of docs/ingredient-normalization.md: expand. Additive only.
--
-- 1. ingredients.name_key: the matching key from ingredientKey() in
--    src/features/ingredients/utils/ingredientKey.ts (case, accents,
--    punctuation, spaces and plurals ignored). The app computes it; Postgres
--    can't (unaccent isn't immutable and the plural rules would be duplicated).
--    Nullable with a plain index for now: existing duplicates share keys until
--    the step 7 cleanup merges them; step 8 makes it not null + unique.
-- 2. ingredient_aliases: synonyms that no spelling rule finds ("scallions" →
--    green onion). Part of the shared catalog, with the same RLS as
--    ingredients. Starts empty: most known synonyms are still separate
--    ingredients, so they become aliases when step 7 merges them.

-- ── 1. Matching key ─────────────────────────────────────────────────────────
alter table public.ingredients
  add column if not exists name_key text;

create index if not exists ingredients_name_key_idx
  on public.ingredients (name_key);

-- ── 2. Alias table ──────────────────────────────────────────────────────────
create table if not exists public.ingredient_aliases (
  id uuid primary key default gen_random_uuid(),
  -- ingredientKey() of the alias; one alias points at one ingredient.
  alias_key text not null unique,
  -- The alias as first written, e.g. "scallions".
  alias_name text not null,
  ingredient_id uuid not null references public.ingredients on delete cascade,
  -- seed: added by a migration; merge: a name merged away by the cleanup;
  -- ai: suggested by import/generate; user: added in the app (later).
  source text not null check (source in ('seed', 'merge', 'ai', 'user')),
  -- Only approved aliases are used. AI aliases are approved only when the
  -- target already exists in the same category; otherwise pending.
  status text not null default 'approved' check (status in ('approved', 'pending')),
  created_at timestamptz not null default now()
);

create index if not exists ingredient_aliases_ingredient_id_idx
  on public.ingredient_aliases (ingredient_id);

alter table public.ingredient_aliases enable row level security;

-- Same as ingredients: any signed-in user can read and add; nobody can edit
-- or delete from the app (bad rows are removed by a migration).
create policy "Authenticated users can read ingredient aliases"
  on public.ingredient_aliases for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert ingredient aliases"
  on public.ingredient_aliases for insert
  with check (auth.role() = 'authenticated');
