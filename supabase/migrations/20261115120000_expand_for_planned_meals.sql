-- Step 1 ("expand") of docs/meal-planning-redesign.md.
--
-- Additive only: the current app keeps working unchanged. Nothing is dropped
-- or deleted. Rollback: drop the new tables/columns/index and restore the
-- previous meal_plan_items policy (see the end of this file).

-- ── 1. Planned meals belong directly to a user ──────────────────────────────

-- New rows get the signed-in user automatically, so the current app (which
-- doesn't send user_id) keeps every row owned without any code change.
alter table public.meal_plan_items
  add column if not exists user_id uuid
    references auth.users on delete cascade
    default auth.uid();

-- Existing rows: owner of the plan they belong to.
update public.meal_plan_items i
set user_id = mp.user_id
from public.meal_plans mp
where mp.id = i.meal_plan_id
  and i.user_id is null;

-- The calendar reads "my meals between two dates".
create index if not exists meal_plan_items_user_planned_for_idx
  on public.meal_plan_items (user_id, planned_for);

-- Step 2 will add meals without a plan, so a plan is no longer required.
alter table public.meal_plan_items
  alter column meal_plan_id drop not null;

-- One combined policy instead of adding a second one: permissive policies are
-- OR-ed, so a separate "own user_id" policy would let someone attach a meal to
-- another user's plan. Rows are visible only to their owner, and a meal can
-- only be attached to a plan the same user owns.
drop policy if exists "Inherit plan access via meal_plan_id" on public.meal_plan_items;
create policy "Users manage own planned meals" on public.meal_plan_items
  for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (
      meal_plan_id is null
      or exists (
        select 1 from public.meal_plans m
        where m.id = meal_plan_id and m.user_id = auth.uid()
      )
    )
  );

-- ── 2. Saved plans as frozen copies (created empty) ─────────────────────────
-- Existing saved plans are copied in step 2.2, in the same release as the code
-- that starts using these tables, so the copy is current.

create table if not exists public.saved_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  source_start_date date not null,
  source_end_date date not null,
  created_at timestamptz not null default now(),
  constraint saved_plans_user_name_unique unique (user_id, name),
  constraint saved_plans_range_check check (source_end_date >= source_start_date)
);

alter table public.saved_plans enable row level security;

create policy "Users manage own saved plans" on public.saved_plans
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists saved_plans_user_id_idx on public.saved_plans (user_id);

create table if not exists public.saved_plan_meals (
  id uuid primary key default gen_random_uuid(),
  saved_plan_id uuid not null references public.saved_plans on delete cascade,
  day_offset int not null check (day_offset >= 0),
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner')),
  recipe_id uuid references public.recipes on delete set null,
  servings_override int check (servings_override is null or servings_override > 0)
);

alter table public.saved_plan_meals enable row level security;

create policy "Inherit access via saved_plan_id" on public.saved_plan_meals
  for all
  using (exists (
    select 1 from public.saved_plans p
    where p.id = saved_plan_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.saved_plans p
    where p.id = saved_plan_id and p.user_id = auth.uid()
  ));

create index if not exists saved_plan_meals_saved_plan_id_idx
  on public.saved_plan_meals (saved_plan_id);

-- ── 3. Grocery lists remember what they were built from ────────────────────

alter table public.grocery_lists
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists saved_plan_id uuid references public.saved_plans on delete set null;

alter table public.grocery_lists
  add constraint grocery_lists_range_check
  check (start_date is null or end_date is null or end_date >= start_date);

-- Existing lists: the date range of the plan they were built from. Re-run in
-- step 2.3 for lists created before the app starts saving ranges itself.
update public.grocery_lists g
set start_date = mp.start_date,
    end_date = coalesce(mp.end_date, mp.start_date + 6)
from public.meal_plans mp
where mp.id = g.meal_plan_id
  and g.start_date is null;

-- ── Rollback (manual, if needed) ─────────────────────────────────────────────
-- drop policy "Users manage own planned meals" on public.meal_plan_items;
-- create policy "Inherit plan access via meal_plan_id" on public.meal_plan_items
--   for all using (exists (select 1 from public.meal_plans m where m.id = meal_plan_id and m.user_id = auth.uid()))
--   with check (exists (select 1 from public.meal_plans m where m.id = meal_plan_id and m.user_id = auth.uid()));
-- alter table public.grocery_lists drop constraint grocery_lists_range_check,
--   drop column saved_plan_id, drop column end_date, drop column start_date;
-- drop table public.saved_plan_meals; drop table public.saved_plans;
-- drop index public.meal_plan_items_user_planned_for_idx;
-- (meal_plan_id stays nullable; user_id can stay, it's harmless)
