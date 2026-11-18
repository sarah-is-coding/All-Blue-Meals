-- Recipe notes: a dated log of notes about a recipe ("doubled the garlic,
-- needed 10 more minutes"), shown newest first under the instructions.
-- Recipes are private, so notes are only ever seen by the recipe's owner:
-- access is inherited from the recipe, like recipe_ingredients.

create table if not exists public.recipe_notes (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.recipe_notes enable row level security;

drop policy if exists "Inherit recipe access via recipe_id" on public.recipe_notes;
create policy "Inherit recipe access via recipe_id" on public.recipe_notes
  for all
  to authenticated
  using (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid()))
  with check (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid()));

-- A recipe's notes, newest first.
create index if not exists recipe_notes_recipe_id_created_at_idx
  on public.recipe_notes (recipe_id, created_at desc);
