-- Redesign step 2a (docs/meal-planning-redesign.md): grocery lists now save
-- the date range they were built from. Fill it in for lists created since
-- step 1 by the previous app version, from the plan they were linked to.
-- Same update as step 1; only touches lists that still have no dates.
update public.grocery_lists g
set start_date = mp.start_date,
    end_date = coalesce(mp.end_date, mp.start_date + 6)
from public.meal_plans mp
where mp.id = g.meal_plan_id
  and g.start_date is null;
