-- Step 3 of docs/ingredient-normalization.md: store ingredient order.
--
-- Recipe detail sorted by created_at, but a recipe's ingredients are inserted
-- in one statement and share a timestamp, so the order shown was whatever
-- Postgres returned. position (0-based, per recipe) fixes it.
--
-- Backfill keeps the order users see today: created_at, then physical row
-- order (ctid), which is how ties have been returned so far.
-- The default 0 is for the app still on main, which doesn't send position;
-- its rows sort by created_at after position, as before.

alter table public.recipe_ingredients
  add column if not exists position smallint not null default 0;

update public.recipe_ingredients as ri
set position = ordered.position
from (
  select ctid,
         (row_number() over (partition by recipe_id order by created_at, ctid) - 1)::smallint
           as position
  from public.recipe_ingredients
) as ordered
where ri.ctid = ordered.ctid;

create index if not exists recipe_ingredients_recipe_id_position_idx
  on public.recipe_ingredients (recipe_id, position);
