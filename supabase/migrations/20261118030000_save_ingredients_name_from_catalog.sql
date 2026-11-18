-- Step 8 of docs/ingredient-normalization.md, part 1 (expand): the app stops
-- sending recipe_ingredients.ingredient_name. save_recipe_ingredients copies
-- the catalog ingredient's name into it instead, so the column stays filled
-- for the app still on main (which reads it and inserts rows directly, never
-- through this function) until the contract migration drops it.
--
-- Same function as 20261117160000_recipe_ingredient_substitutes.sql except
-- for where ingredient_name comes from. create or replace keeps its grants.

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
    -- The catalog's name; an unknown id fails the foreign key as before.
    coalesce(
      (select i.name from public.ingredients i where i.id = (incoming.value ->> 'ingredient_id')::uuid),
      incoming.value ->> 'ingredient_name'
    ),
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
