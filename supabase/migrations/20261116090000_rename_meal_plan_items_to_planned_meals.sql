-- Step 2e of docs/meal-planning-redesign.md: rename only, no behaviour change.
--
-- A row is one meal scheduled on one date for one person — a planned meal.
-- "Items" only made sense as items of a meal_plans container, which nothing
-- reads or writes any more (step 2d). Released in the same commit as the code
-- renames, because the old table name stops working the moment this runs.
--
-- Renaming a table keeps its columns, data, constraints, policies and
-- triggers, but indexes and constraints keep their old names, so they're
-- renamed to match.

alter table public.meal_plan_items rename to planned_meals;

alter index public.meal_plan_items_meal_plan_id_idx
  rename to planned_meals_meal_plan_id_idx;
alter index public.meal_plan_items_recipe_id_idx
  rename to planned_meals_recipe_id_idx;
alter index public.meal_plan_items_user_planned_for_idx
  rename to planned_meals_user_planned_for_idx;

alter table public.planned_meals
  rename constraint meal_plan_items_pkey to planned_meals_pkey;
alter table public.planned_meals
  rename constraint meal_plan_items_meal_plan_id_fkey to planned_meals_meal_plan_id_fkey;
alter table public.planned_meals
  rename constraint meal_plan_items_recipe_id_fkey to planned_meals_recipe_id_fkey;
alter table public.planned_meals
  rename constraint meal_plan_items_user_id_fkey to planned_meals_user_id_fkey;
alter table public.planned_meals
  rename constraint meal_plan_items_meal_type_check to planned_meals_meal_type_check;
alter table public.planned_meals
  rename constraint meal_plan_items_servings_override_check to planned_meals_servings_override_check;
