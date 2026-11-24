-- Rewrite every RLS policy to follow principles/supabase-postgres.md:
--   * one policy per operation instead of `for all`, so each check says
--     which operation it guards;
--   * `to authenticated` instead of the default `public` (which includes anon);
--   * `(select auth.uid())`, evaluated once per query instead of once per row
--     (Supabase advisor 0003 auth_rls_initplan).
-- Access doesn't change: owners still read and write only their own rows,
-- signed-in users still read the catalog and add ingredients, and anon
-- still gets nothing.
--
-- Also indexes the three foreign keys without a covering index (advisor 0001)
-- and drops pg_graphql, which the app doesn't use (decision D1 in
-- principles/evaluations/2026-11-24-plan.md).
--
-- A migration runs in one transaction, so no table is ever left without its
-- policies.

-- ── Owner tables: user_id = the signed-in user ────────────────────────────

drop policy if exists "Users manage own profiles" on public.profiles;
create policy "Users read own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users create own profile" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own profile" on public.profiles
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users manage own recipes" on public.recipes;
create policy "Users read own recipes" on public.recipes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users create own recipes" on public.recipes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own recipes" on public.recipes
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own recipes" on public.recipes
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users manage own planned meals" on public.planned_meals;
create policy "Users read own planned meals" on public.planned_meals
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users create own planned meals" on public.planned_meals
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own planned meals" on public.planned_meals
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own planned meals" on public.planned_meals
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users manage own saved plans" on public.saved_plans;
create policy "Users read own saved plans" on public.saved_plans
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users create own saved plans" on public.saved_plans
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own saved plans" on public.saved_plans
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own saved plans" on public.saved_plans
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ── Child tables: owned through their parent ──────────────────────────────

drop policy if exists "Inherit recipe access via recipe_id" on public.recipe_ingredients;
create policy "Users read own recipe ingredients" on public.recipe_ingredients
  for select to authenticated using (exists (
    select 1 from public.recipes r
    where r.id = recipe_id and r.user_id = (select auth.uid())));
create policy "Users create own recipe ingredients" on public.recipe_ingredients
  for insert to authenticated with check (exists (
    select 1 from public.recipes r
    where r.id = recipe_id and r.user_id = (select auth.uid())));
create policy "Users update own recipe ingredients" on public.recipe_ingredients
  for update to authenticated
  using (exists (
    select 1 from public.recipes r
    where r.id = recipe_id and r.user_id = (select auth.uid())))
  with check (exists (
    select 1 from public.recipes r
    where r.id = recipe_id and r.user_id = (select auth.uid())));
create policy "Users delete own recipe ingredients" on public.recipe_ingredients
  for delete to authenticated using (exists (
    select 1 from public.recipes r
    where r.id = recipe_id and r.user_id = (select auth.uid())));

drop policy if exists "Inherit recipe access via recipe_id" on public.recipe_notes;
create policy "Users read own recipe notes" on public.recipe_notes
  for select to authenticated using (exists (
    select 1 from public.recipes r
    where r.id = recipe_id and r.user_id = (select auth.uid())));
create policy "Users create own recipe notes" on public.recipe_notes
  for insert to authenticated with check (exists (
    select 1 from public.recipes r
    where r.id = recipe_id and r.user_id = (select auth.uid())));
create policy "Users update own recipe notes" on public.recipe_notes
  for update to authenticated
  using (exists (
    select 1 from public.recipes r
    where r.id = recipe_id and r.user_id = (select auth.uid())))
  with check (exists (
    select 1 from public.recipes r
    where r.id = recipe_id and r.user_id = (select auth.uid())));
create policy "Users delete own recipe notes" on public.recipe_notes
  for delete to authenticated using (exists (
    select 1 from public.recipes r
    where r.id = recipe_id and r.user_id = (select auth.uid())));

drop policy if exists "Inherit access via saved_plan_id" on public.saved_plan_meals;
create policy "Users read own saved plan meals" on public.saved_plan_meals
  for select to authenticated using (exists (
    select 1 from public.saved_plans p
    where p.id = saved_plan_id and p.user_id = (select auth.uid())));
create policy "Users create own saved plan meals" on public.saved_plan_meals
  for insert to authenticated with check (exists (
    select 1 from public.saved_plans p
    where p.id = saved_plan_id and p.user_id = (select auth.uid())));
create policy "Users update own saved plan meals" on public.saved_plan_meals
  for update to authenticated
  using (exists (
    select 1 from public.saved_plans p
    where p.id = saved_plan_id and p.user_id = (select auth.uid())))
  with check (exists (
    select 1 from public.saved_plans p
    where p.id = saved_plan_id and p.user_id = (select auth.uid())));
create policy "Users delete own saved plan meals" on public.saved_plan_meals
  for delete to authenticated using (exists (
    select 1 from public.saved_plans p
    where p.id = saved_plan_id and p.user_id = (select auth.uid())));

-- ── Shared catalog: any signed-in user reads; ingredients can be added ────
-- No update/delete policies (AGENTS.md); aliases are added only by
-- migrations or add_ingredient_alias.

drop policy if exists "Authenticated users can read ingredients" on public.ingredients;
drop policy if exists "Authenticated users can insert ingredients" on public.ingredients;
create policy "Authenticated users can read ingredients" on public.ingredients
  for select to authenticated using (true);
create policy "Authenticated users can insert ingredients" on public.ingredients
  for insert to authenticated with check (true);

drop policy if exists "Authenticated users can read ingredient aliases" on public.ingredient_aliases;
create policy "Authenticated users can read ingredient aliases" on public.ingredient_aliases
  for select to authenticated using (true);

-- ingredient_categories already has a correct `to authenticated` read policy.

-- ── Foreign keys without a covering index ─────────────────────────────────
-- Deleting a recipe sets saved_plan_meals.recipe_id to null, which scans
-- that table without this index.
create index if not exists saved_plan_meals_recipe_id_idx
  on public.saved_plan_meals (recipe_id);
create index if not exists ingredients_category_idx
  on public.ingredients (category);
create index if not exists recipe_ingredients_recipe_id_substitute_for_idx
  on public.recipe_ingredients (recipe_id, substitute_for);

-- ── GraphQL: unused, and exposes the schema's shape to anon ───────────────
drop extension if exists pg_graphql;
