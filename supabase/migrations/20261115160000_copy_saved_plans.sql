-- Step 2b of docs/meal-planning-redesign.md: saved plans become frozen copies.
--
-- Copy every existing saved plan (a meal_plans row with saved_name) into
-- saved_plans / saved_plan_meals: its meals within its own dates, stored as day
-- offsets from its start. Released together with the code that reads the new
-- tables. Idempotent: a plan already copied (same user + name) is skipped.
-- Nothing is removed from meal_plans; that happens in the contract step.

with source as (
  select mp.id as old_id,
         mp.user_id,
         mp.saved_name,
         mp.start_date,
         coalesce(mp.end_date, mp.start_date + 6) as end_date,
         mp.created_at
  from public.meal_plans mp
  where mp.saved_name is not null
    and not exists (
      select 1 from public.saved_plans sp
      where sp.user_id = mp.user_id and sp.name = mp.saved_name
    )
),
copied as (
  insert into public.saved_plans (user_id, name, source_start_date, source_end_date, created_at)
  select user_id, saved_name, start_date, end_date, created_at from source
  returning id, user_id, name
)
insert into public.saved_plan_meals (saved_plan_id, day_offset, meal_type, recipe_id, servings_override)
select c.id,
       i.planned_for - s.start_date,
       i.meal_type,
       i.recipe_id,
       i.servings_override
from copied c
join source s on s.user_id = c.user_id and s.saved_name = c.name
join public.meal_plan_items i on i.meal_plan_id = s.old_id
where i.planned_for between s.start_date and s.end_date
  and i.meal_type in ('breakfast', 'lunch', 'dinner');

-- Grocery lists built from a saved plan (step 2a saved them with meal_plan_id
-- and no dates) now link to its copy instead.
update public.grocery_lists g
set saved_plan_id = sp.id
from public.meal_plans mp
join public.saved_plans sp on sp.user_id = mp.user_id and sp.name = mp.saved_name
where g.meal_plan_id = mp.id
  and g.start_date is null
  and g.saved_plan_id is null;
