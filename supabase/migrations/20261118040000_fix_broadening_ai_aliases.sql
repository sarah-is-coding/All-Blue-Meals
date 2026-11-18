-- Fix the two AI aliases that made an ingredient broader instead of naming a
-- synonym (docs/ingredient-normalization.md, "AI-created aliases"): the
-- Chicken Francese import matched "skinless boneless chicken breasts" to
-- plain chicken breasts and "flat-leaf parsley" to parsley, so the grocery
-- list lost words that change what you buy. The app now saves such aliases
-- as pending (dropsWords). Matched by name; on a fresh database nothing
-- matches and nothing changes.

-- 1. "skinless boneless" is "boneless skinless" in another order: the catalog
--    already has that ingredient. Point the alias (now a seed synonym) and the
--    recipe rows at it, and add the same synonym for thighs.
update public.ingredient_aliases a
set ingredient_id = target.id, source = 'seed', status = 'approved'
from public.ingredients target
where a.alias_key = 'skinlessbonelesschickenbreast'
  and target.name_key = 'bonelessskinlesschickenbreast';

update public.recipe_ingredients r
set ingredient_id = target.id, ingredient_name = target.name
from public.ingredients target, public.ingredients broad
where r.ingredient_id = broad.id
  and broad.name_key = 'chickenbreast'
  and lower(r.ingredient_name) = 'skinless boneless chicken breasts'
  and target.name_key = 'bonelessskinlesschickenbreast';

insert into public.ingredient_aliases (alias_key, alias_name, ingredient_id, source, status)
select 'skinlessbonelesschickenthigh', 'skinless boneless chicken thighs', i.id, 'seed', 'approved'
from public.ingredients i
where i.name_key = 'bonelessskinlesschickenthigh'
on conflict (alias_key) do nothing;

-- 2. Flat-leaf parsley is its own item at the store: its own ingredient, used
--    by the rows written that way, and no alias to plain parsley.
delete from public.ingredient_aliases
where alias_key = 'flatleafparsley' and source = 'ai';

insert into public.ingredients (name, name_key, category)
select 'flat-leaf parsley', 'flatleafparsley', 'produce'
where exists (
  select 1 from public.recipe_ingredients r
  join public.ingredients broad on broad.id = r.ingredient_id
  where broad.name_key = 'parsley' and lower(r.ingredient_name) = 'flat-leaf parsley')
on conflict (name) do nothing;

update public.recipe_ingredients r
set ingredient_id = target.id, ingredient_name = target.name
from public.ingredients target, public.ingredients broad
where r.ingredient_id = broad.id
  and broad.name_key = 'parsley'
  and lower(r.ingredient_name) = 'flat-leaf parsley'
  and target.name_key = 'flatleafparsley';
