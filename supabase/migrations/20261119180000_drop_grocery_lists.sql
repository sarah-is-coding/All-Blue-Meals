-- Saved grocery lists were removed from the app: the grocery page builds a
-- list from planned meals when asked, and ticks live only on the page.
-- Nothing reads these tables any more (no app code, edge function, database
-- function, view or foreign key from another table), so they're dropped,
-- with their policies and indexes. On a fresh database they're created by
-- earlier migrations and dropped here.

drop table if exists public.grocery_items;
drop table if exists public.grocery_lists;
