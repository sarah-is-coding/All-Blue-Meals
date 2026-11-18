-- Filtering recipes by tag ignores case: "Italian", "italian" and "ITALIAN"
-- find the same recipes. The tags themselves keep the case they were saved
-- with; tags_lower is a lowercase copy kept up to date by Postgres, and the
-- filter matches against it.

create or replace function public.lowercase_tags(p_tags text[])
returns text[]
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(array_agg(lower(tag) order by ord), '{}')
  from unnest(p_tags) with ordinality as t(tag, ord)
$$;

alter table public.recipes
  add column if not exists tags_lower text[]
  generated always as (public.lowercase_tags(tags)) stored;
