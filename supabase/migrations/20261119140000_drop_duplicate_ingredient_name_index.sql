-- ingredients_name_idx is a plain index on ingredients.name, identical to
-- ingredients_name_key, the index behind the unique constraint on name. The
-- unique index already serves every lookup and sort by name, so the plain
-- one only cost storage and an extra write per insert.

drop index if exists public.ingredients_name_idx;
