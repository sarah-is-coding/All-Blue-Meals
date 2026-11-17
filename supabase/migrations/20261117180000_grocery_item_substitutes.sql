-- Step 6 of docs/ingredient-normalization.md: show substitutes on the grocery
-- list as options ("or avocado oil, 2 tbsp") without making them items to buy.
--
-- Display text, like ingredient_name: a saved list is a snapshot, so later
-- recipe edits don't change it. Small (a few short strings per item at most).
-- No new policies: the column is on grocery_items, already covered by
-- "Inherit list access via list_id".

alter table public.grocery_items
  add column if not exists substitutes text[] not null default '{}';
