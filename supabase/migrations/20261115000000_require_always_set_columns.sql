-- Make columns the app always sets NOT NULL, so the schema (and the
-- generated TypeScript types) match what the code assumes.
--
-- Every column here already has a default or is always written by the app.
-- If any existing row is NULL in a column without a backfill below, this
-- migration fails and rolls back rather than guessing a value.

-- grocery_items.is_checked: default false; treat any NULL as unchecked.
update public.grocery_items set is_checked = false where is_checked is null;
alter table public.grocery_items alter column is_checked set not null;

-- created_at defaults to now() on every table.
alter table public.profiles           alter column created_at set not null;
alter table public.recipes            alter column created_at set not null;
alter table public.recipe_ingredients alter column created_at set not null;
alter table public.ingredients        alter column created_at set not null;
alter table public.meal_plans         alter column created_at set not null;
alter table public.meal_plan_items    alter column created_at set not null;
alter table public.grocery_lists      alter column created_at set not null;
alter table public.grocery_items      alter column created_at set not null;

-- meal_plans.start_date: every plan the app creates is anchored to a week.
alter table public.meal_plans alter column start_date set not null;
