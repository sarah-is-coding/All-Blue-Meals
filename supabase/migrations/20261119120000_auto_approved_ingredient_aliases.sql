-- AI-suggested aliases are decided automatically: added as approved when
-- safe, otherwise not saved at all (the name becomes its own ingredient, so
-- the worst case is a duplicate, never a wrong merge). There is no pending
-- queue, since nobody reviewed it.
--
-- Clients no longer insert into the shared ingredient_aliases table
-- directly: add_ingredient_alias re-checks the rules, so a client can't
-- add a misleading alias. The app checks the same rules first
-- (isSafeSynonym in src/features/ingredients/utils/ingredientKey.ts).
-- Seed and merge aliases come only from migrations, which bypass RLS.

-- 1. Only approved aliases exist -----------------------------------------------

delete from public.ingredient_aliases where status <> 'approved';

alter table public.ingredient_aliases drop constraint if exists ingredient_aliases_status_check;
alter table public.ingredient_aliases add constraint ingredient_aliases_status_check check (status = 'approved');

-- 2. No direct inserts from clients ----------------------------------------------

drop policy if exists "Authenticated users can insert ingredient aliases" on public.ingredient_aliases;

-- 3. Words of a name, for the checks below ---------------------------------------
-- Like the app's foldText: lowercase, common accents folded, ®™© and
-- apostrophes dropped, "&" as "and", other punctuation as spaces. Anything it
-- folds differently is rejected (the safe side).

create or replace function public.ingredient_name_words(p_name text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(word order by ord), '{}')
  from regexp_split_to_table(
    btrim(regexp_replace(
      replace(
        regexp_replace(
          translate(lower(coalesce(p_name, '')), 'áàâäãåéèêëíìîïóòôöõúùûüñç', 'aaaaaaeeeeiiiiooooouuuunc'),
          '[®™©''’`]', '', 'g'),
        '&', ' and '),
      '[^a-z0-9]+', ' ', 'g')),
    ' ') with ordinality as w(word, ord)
  where word <> ''
$$;

-- A word and the singular forms the app's key could have given it
-- ("tomatoes" → tomatoes, tomatoe, tomato; "berries" → berry; "leaves" → leaf).
create or replace function public.ingredient_word_forms(p_word text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array_remove(array[
    p_word,
    case when p_word ~ 's$' then left(p_word, -1) end,
    case when p_word ~ 'es$' then left(p_word, -2) end,
    case when p_word ~ 'ies$' then left(p_word, -3) || 'y' end,
    case when p_word ~ 'ves$' then left(p_word, -3) || 'f' end
  ], null)
$$;

-- 4. Adding an alias ----------------------------------------------------------------

-- Returns true when the alias now exists and points at p_ingredient_id
-- (added now or already there), false when it was refused or the key
-- already belongs to something else.
create or replace function public.add_ingredient_alias(
  p_alias_key text,
  p_alias_name text,
  p_ingredient_id uuid,
  p_category text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.ingredients%rowtype;
  alias_words text[] := public.ingredient_name_words(p_alias_name);
  target_words text[];
  key_pattern text;
  shared int;
begin
  if p_alias_key is null or p_alias_key !~ '^[a-z0-9]{1,100}$'
     or length(btrim(coalesce(p_alias_name, ''))) not between 1 and 100
     or cardinality(alias_words) = 0 then
    return false;
  end if;

  select * into target from public.ingredients where id = p_ingredient_id;
  if not found or target.category is distinct from p_category then
    return false;
  end if;

  -- The key must be this name's key: each word, in order, as written or in a
  -- singular form. Stops a client sending a key for some other name.
  select '^' || string_agg('(' || array_to_string(public.ingredient_word_forms(word), '|') || ')', '' order by ord) || '$'
    into key_pattern
  from unnest(alias_words) with ordinality as w(word, ord);
  if p_alias_key !~ key_pattern then
    return false;
  end if;

  -- Never hide an existing ingredient, and never point at the same name.
  if p_alias_key = target.name_key
     or exists (select 1 from public.ingredients i where i.name_key = p_alias_key) then
    return false;
  end if;

  -- Same words in another order, or none in common; anything in between is a
  -- variant or a broader/narrower item. Words compared without a trailing s.
  target_words := public.ingredient_name_words(target.name);
  select count(*) into shared
  from (select distinct regexp_replace(a, 'e?s$', '') as stem from unnest(alias_words) as a) aw
  where aw.stem in (select regexp_replace(t, 'e?s$', '') from unnest(target_words) as t);
  if not (
    shared = 0
    or (shared = (select count(distinct regexp_replace(a, 'e?s$', '')) from unnest(alias_words) as a)
        and shared = (select count(distinct regexp_replace(t, 'e?s$', '')) from unnest(target_words) as t))
  ) then
    return false;
  end if;

  insert into public.ingredient_aliases (alias_key, alias_name, ingredient_id, source, status)
  values (p_alias_key, lower(btrim(p_alias_name)), p_ingredient_id, 'ai', 'approved')
  on conflict (alias_key) do nothing;

  return exists (
    select 1 from public.ingredient_aliases a
    where a.alias_key = p_alias_key and a.ingredient_id = p_ingredient_id
  );
end;
$$;

revoke execute on function public.add_ingredient_alias(text, text, uuid, text) from public, anon;
grant execute on function public.add_ingredient_alias(text, text, uuid, text) to authenticated;
