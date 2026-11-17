-- Step 3 of docs/meal-planning-redesign.md: contract. IRREVERSIBLE.
--
-- Since step 2d the app neither reads nor writes meal_plans, and since 2b
-- saved plans live in saved_plans / saved_plan_meals. This removes what's
-- left of the old model. Run the read-only listing in the design doc first:
-- the rows deleted in section 1 are gone for good, as is every meal_plans row.

-- ── 1. Meals the app never shows (decision 5) ───────────────────────────────
-- The planner only has breakfast, lunch and dinner; anything else was hidden.
delete from public.planned_meals
where meal_type is null
   or meal_type not in ('breakfast', 'lunch', 'dinner');

-- ── 2. Ownership is user_id alone ───────────────────────────────────────────
-- The step 1 policy also checked that an attached plan was the user's own.
-- With no plans left to attach, it reduces to the owner check (and must be
-- replaced before meal_plan_id can be dropped, since it refers to it).
drop policy if exists "Users manage own planned meals" on public.planned_meals;
create policy "Users manage own planned meals" on public.planned_meals
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── 3. Drop the container ───────────────────────────────────────────────────
-- Dropping a column also drops its index and foreign key.
alter table public.planned_meals drop column meal_plan_id;
alter table public.grocery_lists drop column meal_plan_id;
drop table public.meal_plans;

-- ── 4. Columns the app always sets ──────────────────────────────────────────
-- Section 1 removed the only rows that could break these.
alter table public.planned_meals
  alter column meal_type set not null,
  alter column user_id set not null;

alter table public.planned_meals
  drop constraint planned_meals_meal_type_check,
  add constraint planned_meals_meal_type_check
    check (meal_type in ('breakfast', 'lunch', 'dinner'));
