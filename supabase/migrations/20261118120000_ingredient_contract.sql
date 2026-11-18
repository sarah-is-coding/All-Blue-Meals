-- Step 8 of docs/ingredient-normalization.md, part 2 (contract). Applied
-- only after the app that reads names from the catalog was deployed (PR #1):
--
-- 1. Every ingredient has a key, and no two share one. The app looks
--    ingredients up by key and no longer falls back to the exact name.
-- 2. recipe_ingredients.ingredient_name is dropped: the name is the catalog
--    ingredient's. save_recipe_ingredients stops writing it.

-- 1. name_key: required and unique ------------------------------------------

do $$
begin
  if exists (select 1 from public.ingredients where name_key is null) then
    raise exception 'ingredients without a name_key: set them before this migration';
  end if;
end $$;

alter table public.ingredients alter column name_key set not null;

-- The unique constraint's index replaces the plain one from step 2.
drop index if exists public.ingredients_name_key_idx;
alter table public.ingredients
  add constraint ingredients_name_key_unique unique (name_key);

-- 2. recipe_ingredients.ingredient_name --------------------------------------

-- Same as 20261118030000 without ingredient_name. create or replace keeps
-- its grants (authenticated only).
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
    (id, recipe_id, ingredient_id, quantity, quantity_numeric,
     unit, notes, position, substitute_for)
  select
    incoming.new_id,
    p_recipe_id,
    (incoming.value ->> 'ingredient_id')::uuid,
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

alter table public.recipe_ingredients drop column ingredient_name;
