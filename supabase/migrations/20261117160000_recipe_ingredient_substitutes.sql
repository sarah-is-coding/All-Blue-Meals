-- Step 4 of docs/ingredient-normalization.md: substitutes ("olive oil or
-- avocado oil" as two rows, each linked to its own catalog ingredient).
--
-- A row with substitute_for = null is a main ingredient (every row today).
-- A row with substitute_for set is a substitute for that main row. Each
-- substitute keeps its own quantity, unit and notes ("1 cup butter or 3/4 cup
-- oil"). Grocery lists use main rows only.
--
-- The foreign key includes recipe_id, so a substitute can only point at a row
-- in the same recipe: RLS checks the row being written, not the row it points
-- at, so a plain foreign key would let a row point into another user's recipe.
-- No new policies: substitutes are recipe_ingredients rows, already covered by
-- "Inherit recipe access via recipe_id".

-- ── 1. Column and same-recipe foreign key ──────────────────────────────────
alter table public.recipe_ingredients
  add constraint recipe_ingredients_recipe_id_id_key unique (recipe_id, id);

alter table public.recipe_ingredients
  add column if not exists substitute_for uuid;

alter table public.recipe_ingredients
  add constraint recipe_ingredients_substitute_for_fkey
  foreign key (recipe_id, substitute_for)
  references public.recipe_ingredients (recipe_id, id)
  on delete cascade;

-- A row can't be its own substitute.
alter table public.recipe_ingredients
  add constraint recipe_ingredients_substitute_not_self
  check (substitute_for is null or substitute_for <> id);

create index if not exists recipe_ingredients_substitute_for_idx
  on public.recipe_ingredients (substitute_for)
  where substitute_for is not null;

-- ── 2. Atomic save, now with substitutes ───────────────────────────────────
-- Each element of p_rows may have "substitute_of": the 0-based index (in
-- p_rows) of the main row it substitutes for. Ids are generated up front so
-- one insert can link rows to each other: Postgres checks the foreign key at
-- the end of the statement, after every row exists.

create or replace function public.save_recipe_ingredients(p_recipe_id uuid, p_rows jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'p_rows must be a JSON array';
  end if;

  -- A substitute must point at a main row (one with no substitute_of) in this
  -- list. That also rules out pointing at itself or at another substitute.
  if exists (
    with incoming as (
      select (e.ordinality - 1)::int as idx, (e.value ->> 'substitute_of')::int as sub
      from jsonb_array_elements(p_rows) with ordinality as e(value, ordinality)
    )
    select 1
    from incoming
    where sub is not null
      and sub not in (select idx from incoming where sub is null)
  ) then
    raise exception 'substitute_of must point at a main ingredient in the same list';
  end if;

  delete from public.recipe_ingredients
  where recipe_id = p_recipe_id;

  with incoming as (
    select
      e.value,
      (e.ordinality - 1)::int as idx,
      gen_random_uuid() as new_id
    from jsonb_array_elements(p_rows) with ordinality as e(value, ordinality)
  )
  insert into public.recipe_ingredients
    (id, recipe_id, ingredient_id, ingredient_name, quantity, quantity_numeric,
     unit, notes, position, substitute_for)
  select
    incoming.new_id,
    p_recipe_id,
    (incoming.value ->> 'ingredient_id')::uuid,
    incoming.value ->> 'ingredient_name',
    incoming.value ->> 'quantity',
    (incoming.value ->> 'quantity_numeric')::numeric,
    incoming.value ->> 'unit',
    incoming.value ->> 'notes',
    incoming.idx::smallint,
    main.new_id
  from incoming
  left join incoming as main
    on main.idx = (incoming.value ->> 'substitute_of')::int;
end;
$$;
