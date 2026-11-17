-- Step 3 of docs/ingredient-normalization.md: save a recipe's ingredients
-- atomically.
--
-- Replacing ingredients used to be two requests (delete all, then insert);
-- if the insert failed the recipe was left with none. A function call runs
-- in one transaction, so either the new list is saved or the old one stays.
--
-- security invoker: runs as the signed-in user, so the recipe_ingredients
-- RLS policy (the recipe must be the user's own) applies to the delete and
-- the insert. Calling it on someone else's recipe deletes nothing and the
-- insert fails the policy, which rolls everything back.
--
-- p_rows is a JSON array in display order; each element has ingredient_id,
-- ingredient_name, quantity, quantity_numeric, unit, notes. Position comes
-- from the array order.

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

  delete from public.recipe_ingredients
  where recipe_id = p_recipe_id;

  insert into public.recipe_ingredients
    (recipe_id, ingredient_id, ingredient_name, quantity, quantity_numeric, unit, notes, position)
  select
    p_recipe_id,
    (r.value ->> 'ingredient_id')::uuid,
    r.value ->> 'ingredient_name',
    r.value ->> 'quantity',
    (r.value ->> 'quantity_numeric')::numeric,
    r.value ->> 'unit',
    r.value ->> 'notes',
    (r.ordinality - 1)::smallint
  from jsonb_array_elements(p_rows) with ordinality as r(value, ordinality);
end;
$$;

revoke execute on function public.save_recipe_ingredients(uuid, jsonb) from public, anon;
grant execute on function public.save_recipe_ingredients(uuid, jsonb) to authenticated;
