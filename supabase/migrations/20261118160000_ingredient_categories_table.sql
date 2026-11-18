-- Step 9 of docs/ingredient-normalization.md, phase 1 (expand): ingredient
-- categories become a table of grocery store departments keyed by a short
-- code, with the label the app shows and a description of what belongs
-- there (for the AI import too). "pantry" is split into store aisles.
--
-- Safe while the app on main still writes the old values ("meat & seafood"):
-- they stay allowed alongside the codes. Phase 2, after this app is
-- deployed, rewrites the data to codes and replaces the CHECK with a foreign
-- key to this table.

-- 1. The table ---------------------------------------------------------------

create table if not exists public.ingredient_categories (
  id text primary key check (id ~ '^[a-z_]+$'),
  name text not null,
  description text not null,
  sort_order smallint not null unique
);

alter table public.ingredient_categories enable row level security;

-- Read-only for signed-in users; changed only by migrations.
drop policy if exists "Authenticated users can read ingredient categories" on public.ingredient_categories;
create policy "Authenticated users can read ingredient categories"
  on public.ingredient_categories for select
  to authenticated
  using (true);

-- Grocery store departments in walking order. Descriptions say what
-- belongs where (the import prompt uses them), naming the usual doubts.
insert into public.ingredient_categories (id, name, description, sort_order) values
  ('produce', 'Produce',
   'Fresh vegetables, fruit and fresh herbs, including garlic, onions, ginger, potatoes, mushrooms, fresh chiles and tofu.', 1),
  ('meat_seafood', 'Meat & Seafood',
   'Fresh meat, poultry, fish and shellfish, ground meat, sausage and bacon.', 2),
  ('deli', 'Deli',
   'Sliced deli meats, cured meats like salami, prosciutto and pepperoni, rotisserie chicken, hummus and prepared salads.', 3),
  ('dairy_eggs', 'Dairy & Eggs',
   'Milk, plant-based milk, cream, half-and-half, butter, cheese, yogurt, sour cream, cream cheese and eggs.', 4),
  ('bakery_bread', 'Bakery & Bread',
   'Bread, buns, rolls, bagels, tortillas, wraps, pita, naan and croissants.', 5),
  ('pasta_rice_grains', 'Pasta, Rice & Grains',
   'Dry pasta and noodles, rice, quinoa, couscous, oats and other grains, dried beans and lentils.', 6),
  ('canned_jarred', 'Canned & Jarred',
   'Canned and jarred vegetables, tomatoes, tomato paste, pasta sauce, beans, broth and stock, soup, coconut milk, olives, pickles and canned fish.', 7),
  ('baking', 'Baking',
   'Flour, sugar, baking soda and powder, yeast, cornstarch, cocoa, chocolate chips, extracts, honey, maple syrup and breadcrumbs.', 8),
  ('spices_seasonings', 'Spices & Seasonings',
   'Salt, pepper, dried herbs, ground and whole spices, spice blends, seasoning mixes and bouillon.', 9),
  ('oils_sauces_condiments', 'Oils, Sauces & Condiments',
   'Cooking oils and sprays, vinegar, soy sauce and other bottled sauces, hot sauce, ketchup, mustard, mayonnaise, dressings, salsa, peanut butter and jam.', 10),
  ('snacks_nuts_dried_fruit', 'Snacks, Nuts & Dried Fruit',
   'Nuts, seeds, dried fruit, chips, crackers, pretzels, popcorn and granola.', 11),
  ('frozen', 'Frozen',
   'Frozen vegetables, fruit, meat and seafood, dough and pie crusts, desserts and ice cream.', 12),
  ('beverages', 'Beverages',
   'Drinks: juice, soda, sparkling water, wine, beer, spirits, coffee and tea.', 13),
  ('other', 'Other',
   'Non-food items only: foil, parchment, skewers, toothpicks.', 14)
on conflict (id) do nothing;

-- 2. Accept the codes as well as the old values (until phase 2) -------------

alter table public.ingredients drop constraint if exists ingredients_category_check;
alter table public.ingredients add constraint ingredients_category_check check (
  category in (
    'produce', 'meat_seafood', 'deli', 'dairy_eggs', 'bakery_bread', 'pasta_rice_grains', 'canned_jarred',
    'baking', 'spices_seasonings', 'oils_sauces_condiments', 'snacks_nuts_dried_fruit', 'frozen', 'beverages', 'other',
    -- old values, until phase 2
    'meat & seafood', 'dairy & eggs', 'bakery & bread', 'pantry'
  )
);

-- 3. Upgrading "other" -------------------------------------------------------
-- Clients can't update the shared catalog (no update policy), so a better
-- category from an import or a person was ignored and "other" was permanent.
-- This only ever fills in an uncategorized row ("other" or empty) with a real
-- category, so any signed-in user may call it.

create or replace function public.upgrade_ingredient_category(p_ingredient_id uuid, p_category text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.ingredients
  set category = p_category
  where id = p_ingredient_id
    and (category is null or category = 'other')
    and p_category <> 'other'
    and exists (select 1 from public.ingredient_categories c where c.id = p_category);
$$;

revoke execute on function public.upgrade_ingredient_category(uuid, text) from public, anon;
grant execute on function public.upgrade_ingredient_category(uuid, text) to authenticated;
