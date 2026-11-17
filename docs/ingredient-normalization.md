# Ingredient normalization and substitutes

Status: **Proposed**. Nothing here is implemented yet. Work happens on the
`ingredient-normalization` branch, one commit per step, with lint, build and
tests passing after each.

## Summary

Stop the shared `ingredients` catalog from filling up with near-duplicates,
let a recipe say "olive oil *or* avocado oil" without inventing a combined
ingredient, and clean up the duplicates already stored.

## Why

### What makes a new ingredient today

`createIngredient` (`src/features/ingredients/api.ts`) lowercases and trims
the name, then does an exact `.eq("name", …)` lookup. No match means a new row.
The database's only guard is `unique (name)`. So case can't duplicate, but
dashes, commas, plurals, accents and extra words all do.

| Path | How the ingredient is chosen |
|---|---|
| Add (manual) | Combobox searches `name ilike %term%`. Picking a result uses its id; "Add new" calls `createIngredient`. |
| Import (URL/paste) | Edge function `import-recipes` asks Gemini for `ingredientName`; `recipeImport.ts` sets `ingredientId: ""`; on save `getIngredientPayload` calls `createIngredient` for each one. |
| Generate | Same edge function and same save path as import. |

Import and generate create most of the duplicates, because no person picks
from the list. The prompt only says "Split ingredients into ingredientName,
quantity, unit, and notes", without saying what belongs in the name.

### What's in the catalog (604 ingredients, checked 2026-11-17)

1. **Spelling variants: 17 groups.** `all-purpose flour` / `all purpose
   flour`, `onion` / `onions`, `jalapeño` / `jalapeños`,
   `boneless, skinless chicken thighs` / `boneless skinless chicken thighs`.
2. **Extra words in the name: about 200 names.** Preparation (`garlic,
   minced`, `minced garlic`), size and freshness (`large onion`, `freshly
   ground black pepper`), combined items (`salt and pepper`, `salt & pepper`).
3. **Alternatives: 42 names** containing "or" or "/" (`olive oil or
   vegetable oil`, `coriander / cilantro`). Each is used by exactly one
   recipe.
4. 19 ingredients no recipe uses; 1 with no category.

### Grocery lists don't use the catalog yet

`mergeIngredients` (`grocery/utils/groceryGeneration.ts`) merges on the
recipe row's own `ingredient_name` text + unit, not on `ingredient_id`. Even a
clean catalog wouldn't merge `onion` and `onions` on a grocery list until
this changes.

## Design

### 1. One module owns the naming rules

`src/features/ingredients/utils/` (`ingredientKey.ts`, `ingredientText.ts`,
`ingredientLine.ts`, word lists in `constants.ts`), pure functions with no
database access:

- `ingredientKey(name)`: the matching key. Lowercase, strip accents
  (`normalize("NFD")` + drop combining marks), turn punctuation into spaces,
  collapse whitespace, singularize each word with simple rules (`-ies → -y`,
  `-oes → -o`, trailing `-s`) plus an exceptions list for words that only
  look plural (`hummus`, `asparagus`, `molasses`, `couscous`, `swiss`, …).
  `"Jalapeños"` and `"jalapeno"` both give
  `"jalapeno"`.
- `parseIngredientName(text)`: separate the base name from size, freshness
  and preparation words, following the **cautious merge rule** below.
  `"large yellow onion, chopped"` → name `yellow onion`, notes `large,
  chopped`. Text after the first comma is treated as notes.

#### Cautious merge rule (decided)

The test is: *would you pick up a different item at the store?* If yes, the
word stays in the name. When a word could go either way, it stays in the name.
A slightly larger catalog is better than a grocery list telling you to buy
the wrong thing.

| Moves to notes | Stays in the name |
|---|---|
| Size: `large`, `medium`, `small`, `extra-large` | Product forms: `ground` (beef, cumin, ginger), `dried`, `canned`, `frozen`, `smoked`, `sun-dried`, `roasted` |
| Freshness: `fresh`, `freshly` | Ambiguous prep, since it can be bought done: `diced`, `crushed`, `shredded`, `grated`, `sliced` (almonds), `minced` (garlic in a jar), `chopped` (walnuts) |
| Home prep after the name or a comma: `chopped`, `minced`, `diced`, `sliced`, `halved`, `peeled`, `trimmed`, `cubed`, `cut into …`, `at room temperature`, `to taste`, `optional` | Variety and type: `cherry` tomatoes, `red` onion, `kosher` salt, `unsalted` butter, `low-sodium` broth, `boneless skinless` chicken thighs |

Where a prep word appears matters. A trailing prep word, or one after a comma,
is something the cook does (`onion, diced` → `onion` + note `diced`). A
leading one is usually the product name (`diced tomatoes`, `shredded
mozzarella`, `chopped walnuts` stay as they are). The exceptions are a few
base ingredients you'd only ever buy whole (`garlic`, `onion`, `parsley`,
`cilantro`, …), where a leading prep word also moves to notes (`minced
garlic` → `garlic` + note `minced`). That list lives in the naming module and
is easy to extend.
- `splitAlternatives(text)`: `"olive or avocado oil"` → `["olive oil",
  "avocado oil"]`; `"chicken or beef broth"` → `["chicken broth", "beef
  broth"]`; `"coriander / cilantro"` → `["coriander", "cilantro"]`. Handles
  the shared-noun case (the noun appears only on the last option).

Every path that creates or matches an ingredient calls these: the combobox,
`createIngredient`, the import mapping, and the one-time cleanup. The edge
function prompt describes the same rules, but the app enforces them.

### 2. Match on the key, not the name

New column `ingredients.name_key text`, unique once the cleanup has run.
`name` stays as the readable name shown in the app.

- The key is computed in TypeScript (`ingredientKey`) and sent on insert.
  Postgres can't compute it in a generated column: `unaccent` isn't
  immutable, and the plural rules would have to be written twice and kept in
  sync.
- `createIngredient(name)` looks up by `name_key`, and the unique index on
  `name_key` turns a race into the existing "fetch the row that won" path.
- `searchIngredients` also matches on the key, so typing "jalapeno" finds
  "jalapeño".
- New `resolveIngredients(names[])`: one query (`name_key in (…)`) for a
  whole recipe, then one batch insert for the missing ones. Replaces the
  one-`createIngredient`-per-row loop in `getIngredientPayload`, which is
  two round trips per ingredient today.

Risk: any signed-in client can insert into the catalog, so a client could
send a wrong key. That's the same trust level as today (it can already insert
any name), and the cleanup script can re-check keys later.

### 3. Substitutes: `recipe_ingredients.substitute_for`

```sql
substitute_for uuid references recipe_ingredients(id) on delete cascade
```

- `null`: a normal (main) ingredient, as today.
- Set: this row is a substitute for that main row. Any number of substitutes
  can point at one main row.
- Each substitute is a full row with its own `ingredient_id`, quantity, unit
  and notes, so "1 cup butter or ¾ cup oil" is stored exactly. No ratio
  column.
- A substitute can't itself have substitutes (checked in app code; a CHECK
  constraint can't look at another row).
- No new RLS policies: substitute rows are `recipe_ingredients` rows and are
  already covered by the ownership check through `recipes`.

Rejected alternatives: a separate `recipe_ingredient_substitutes` table (four
more policies with two-level ownership checks, an extra table, no gain), and
an array of substitute ingredient ids (Postgres can't foreign-key array
elements, so merging catalog ingredients would leave stale ids).

Where it shows up:

| Area | Change |
|---|---|
| Save (`recipes/api.ts`) | Insert main rows first, get their ids, then insert substitutes pointing at them. Still delete-then-insert on edit. |
| Load | Same single query; group substitutes under their main row in the mapper. Types gain `substitutes: RecipeIngredient[]`. |
| Recipe view | One line: "2 tbsp olive oil *or* avocado oil". |
| Recipe form | "Add substitute" on each ingredient row; substitute rows are indented under it and removable. |
| Serving scaling | Scales substitutes like any other row. |
| Grocery lists | Only main rows are items to buy (step 4); their substitutes are shown as options on the item (step 6, see "Substitutes on the grocery list"). |
| Edge function | Ingredient schema gains `substitutes: [{ingredientName, quantity, unit, notes, category}]`. |

Later, without schema changes: let the user pick which option they'll use,
and put that one on the grocery list.

#### Keep a substitute in its own recipe

A plain foreign key lets `substitute_for` point at a row in *any* recipe,
including another user's: RLS checks the row being written, not the row it
points at. Use a composite foreign key so the database guarantees the main
row is in the same recipe:

```sql
alter table recipe_ingredients add unique (recipe_id, id);
alter table recipe_ingredients
  add foreign key (recipe_id, substitute_for)
  references recipe_ingredients (recipe_id, id) on delete cascade;
```

#### Ingredient order is not stored today

Recipe detail sorts ingredients by `created_at`, but a recipe's ingredients
are inserted in one statement and share the same timestamp (125 of 126
recipes have ties). The order shown is whatever Postgres happens to return.
Add `position smallint not null` (backfilled from the current order) and sort
by it. Substitutes get their own position within their main row.

#### Save atomically

`createRecipe` inserts the recipe, then its ingredients; `updateRecipe`
deletes all ingredients, then inserts the new ones. If the second request
fails, the recipe is left with no ingredients. Substitutes add a third
request (main rows, then substitutes), widening that gap. Proposed: one
Postgres function, `save_recipe_ingredients(recipe_id, rows jsonb)`, declared
`security invoker` so RLS still applies. It deletes and inserts in one
transaction and links substitutes by their position in the payload, so the
client doesn't need the main rows' new ids.

### 4. Fix names at the source (import and generate)

The edge function (`supabase/functions/import-recipes/index.ts`) is used by
both import and generate. Its prompt rules (in the shared `recipeOutputRules`)
replace the current one-line rule and state the same cautious merge rule as
the naming module, so the model keeps that information in `notes` from the
start:

- `ingredientName` is only the item you'd buy at the store: `garlic`,
  `yellow onion`, `black pepper`, `cherry tomatoes`.
- Size, freshness and preparation the cook does go in `notes`, never in
  `ingredientName`: `large`, `fresh`, `freshly ground`, `minced`, `chopped`,
  `halved`, `cut into 1-inch cubes`, `at room temperature`, `to taste`.
- Words that make it a different product stay in `ingredientName`: `diced
  tomatoes` (canned), `ground beef`, `dried oregano`, `shredded mozzarella`,
  `unsalted butter`, `low-sodium chicken broth`. If unsure, keep the word in
  the name.
- Combined items become separate ingredients: `salt and pepper` → `salt`,
  `black pepper`.
- Alternatives go in `substitutes`, never "or" inside a name.
- Worked examples in the prompt, e.g. `"2 large garlic cloves, minced"` →
  `{ingredientName: "garlic", quantity: "2", unit: "cloves", notes: "large,
  minced"}`; `"1 can diced tomatoes"` → `{ingredientName: "diced tomatoes",
  quantity: "1", unit: "can", notes: ""}`.

Notes from the model and notes split off by the app are merged without
repeats, so nothing is lost.

The app doesn't rely on the prompt: `mapImportedRecipeTo…` runs every name
through `parseIngredientName` and `splitAlternatives` as a safety net, and
cleans junk values the model returns (see "Junk values" below).

Import and generate each have **two save paths** (`RecipeImportPage`,
`RecipeGeneratePage`):

- **Use draft** opens `/app/recipes/new` with the recipe filled in. Here the
  form can show each ingredient as **matched** to a catalog entry or **new**.
- **Create** saves every extracted recipe straight away with
  `mapImportedRecipeToInput`. No person sees the ingredients, so this path
  depends entirely on the naming rules and `resolveIngredients` matching by
  key. The results panel can show a count ("12 ingredients, 2 new") but no
  per-row review.

The edge function is deployed separately from the web app, so either can be
newer than the other for a while. The app must accept responses with no
`substitutes` field (old function), and the new function's response must not
break the old app (extra fields are ignored today, so deploy the function
first).

### 5. Grocery merge uses the catalog

Merge key becomes `ingredient_id + unit` instead of the recipe row's text +
unit, and the grocery item shows the catalog name. AGENTS.md's merge rule is
updated to match. Existing saved grocery lists are unaffected (they store
their own text).

#### Substitutes on the grocery list

Only the main ingredient is an item to buy, but its substitutes are shown
as options, so you can grab avocado oil if the store is out of olive oil.

- **Storage:** `grocery_items.substitutes text[]`, the options as display
  text (`"avocado oil, 2 tbsp"`). A saved list is a snapshot, like its item
  names, so later recipe edits don't change it. No new table or policies:
  the column is on rows already covered by the list-ownership policy.
- **Generation:** load substitute rows too (drop the `substitute_for is null`
  filter from step 4) and attach each to its main row before merging,
  scaled to the planned servings like the main row. When main rows merge
  (two recipes both use olive oil), their substitutes are combined, with
  repeats removed by ingredient.
- **UI:** an item with options shows a small "2 options" toggle (a large
  enough tap target on phones). Tapping it expands the list under the item
  ("or avocado oil, 2 tbsp"); tapping again collapses it. Checking off the
  item works as today. Collapsed by default so the list stays short.
- **Later, if wanted:** tap an option to swap it in as the item to buy.

### 6. One-time cleanup of existing data

A script (`scripts/ingredient-cleanup/`, run locally, not shipped) reads the
catalog and recipe rows, runs them through the naming module, and writes a
**mapping file for review**: which ingredients merge into which, which recipe
rows get new names/notes, which "or" rows split into main + substitute rows.
Nothing changes until the mapping is approved.

The approved mapping becomes a migration with the mapping as literal data
(so it's reproducible and doesn't depend on the script at deploy time). The
migration matches rows **by ingredient name, never by id**. Migrations also
build fresh databases (CLAUDE.md), where this project's UUIDs don't exist, so
every statement must be a harmless no-op when the names aren't there.

The script also checks for **key collisions**: two ingredients the cautious
rule treats as different products but `ingredientKey` maps to the same key
(e.g. a plural rule that's too eager). Any collision fails the run until the
rule or exceptions list is fixed.

1. For each merge: repoint `recipe_ingredients.ingredient_id` to the kept
   ingredient; move size/prep words into `notes` on affected rows
   (`ingredient_name` is dropped in step 8, so it isn't rewritten).
2. For each "or" row: keep it as the main option, insert substitute rows.
3. Delete merged-away and combined ingredients.
4. Fill in `name_key` for every remaining row; set the missing category.

Then a final contract migration: `name_key not null` + unique index.

### 7. Units

Grocery lists merge on ingredient **and unit**, so a clean catalog still
leaves `2 cups onion` and `1 cup onion` on separate lines. Units are as
messy as names. Among the 40 most common: `cup`/`cups`; `tsp`/`tsp.`/
`teaspoon`/`teaspoons`; `tbsp`/`tbs`/`TBSP.`/`tablespoon`/`Tablespoons`;
`lb`/`lb.`/`lbs`/`pound`/`pounds`; `oz`/`ounces`; `g`/`grams`;
`clove`/`cloves`.

A `normalizeUnit` function in `src/lib/utils/` (grocery and recipes both
need it) maps each spelling to one canonical form (`cup`, `tsp`, `tbsp`, `lb`,
`oz`, `g`, `ml`, `clove`, …). It's applied when saving a recipe and when
merging a grocery list, and the cleanup migration rewrites existing rows.
Converting between units (3 tsp = 1 tbsp) is out of scope.

### 8. Junk values

From the current data, the model sometimes returns:

- the text `"null"` instead of an empty value (26 rows have `unit = 'null'`
  and 26 have `quantity = 'null'`);
- size or prep words as the unit: `large`, `medium`, `small`, `diced`, `to
  taste` (52 rows). These belong in `notes`;
- metric equivalents as the unit: `(60ml)`, `(125ml)` (26 rows).

**Cause of `"null"`.** The response schema makes `quantity`, `unit` and
`notes` required, non-nullable strings, while the prompt says "Use null or
empty strings when missing". The model can't return a real null for those
fields, so it sometimes writes the word. All 26 rows come from 9 recipes
imported on 2026-07-13, and none since, but nothing prevents it. Fixed in
three places:

1. **Prompt:** "When a quantity, unit or note is missing, use an empty
   string `""`. Never write `null`, `none` or `n/a`."
2. **App:** `recipeImport.ts` treats `"null"`, `"none"`, `"n/a"` and
   `"undefined"` (any case) as empty, so a slip from the model is never
   saved, and the save path (`cleanText`) does the same for every text field.
3. **Data:** the cleanup clears the existing 26 + 26 values.

The import mapping also moves size and prep words from `unit` to `notes`;
the cleanup fixes existing rows the same way.

### 9. Smaller fixes found in review

- **Combobox "Add new".** It's always offered, even when the typed text
  matches an existing ingredient by key ("Onions" when `onion` exists).
  `createIngredient` would quietly return `onion`, but the menu is
  misleading. Hide "Add new" when a suggestion has the same key.
- **Search escaping.** `searchIngredients` passes the typed text into `ilike`
  unescaped, so `%` and `_` act as wildcards. Searching both `name` and
  `name_key` needs `.or(...)`, where commas and parentheses in the text would
  break the filter. Escape both.
- **Which name a merged ingredient keeps.** When `onion` and `onions` merge,
  one name is shown everywhere. Decided: the singular form, except for
  things normally bought or written in the plural (`eggs`, `oats`, `cherry
  tomatoes`). The review mapping shows the chosen name for each merge.
- **Supabase test mock.** Add `is`, `or` and `rpc` to the chained methods in
  CLAUDE.md's mock pattern and the existing test files that use it.
- **Edge function has no tests.** Move the prompt text and response schema
  into their own module, and keep a small set of sample ingredient lines with
  the expected result, to check by hand after each prompt change. Ingredient
  lines from the current data make good samples.

### 10. More patterns (second pass over all 604 names)

**a. Compound words written with and without a space.** `bread crumbs` /
`breadcrumbs`, `corn starch` / `cornstarch`, `sundried` / `sun-dried`,
`wholewheat` / `whole-wheat`. Turning punctuation into spaces doesn't help
(`sun dried` ≠ `sundried`). `ingredientKey` removes spaces and hyphens
entirely, so these all match; the collision check catches anything that
shouldn't.

**b. Misspellings and true synonyms.** `potatoe`, `kewpi mayo` / `kewpie
mayo`, `chile powder` / `chili powder`, `scallions` / `green onions` /
`spring onions`, `bbq` / `barbecue`, `heavy whipping cream` / `heavy cream`,
`hamburger buns` / `burger buns`, `cayenne` / `cayenne pepper` / `ground
cayenne pepper`, `red pepper flakes` / `crushed red pepper` / `red crushed
pepper` / `crushed red pepper flakes`, `pak choi` / `bok choy`, `parm` /
`parmesan`. No string rule finds these. They're stored as data in an
**`ingredient_aliases` table**, not hardcoded in the app, so the list can
grow as recipes are imported (see "Alias table" below). Only true synonyms
belong in it. `coriander` is *not* an alias of `cilantro`, because `ground
coriander` is the seed.

**c. An optional last word.** `feta` / `feta cheese`, `ricotta` / `ricotta
cheese`, `parmesan` / `parmesan cheese`, `white miso` / `white miso paste`,
`macaroni` / `macaroni pasta`. Also handled by the alias table.

#### Alias table

```sql
create table public.ingredient_aliases (
  id uuid primary key default gen_random_uuid(),
  alias_key text not null unique,   -- ingredientKey(alias), e.g. "scallion"
  alias_name text not null,         -- as first seen, e.g. "scallions"
  ingredient_id uuid not null references public.ingredients on delete cascade,
  source text not null check (source in ('seed', 'merge', 'ai', 'user')),
  status text not null default 'approved' check (status in ('approved', 'pending')),
  created_at timestamptz not null default now()
);
create index on public.ingredient_aliases (ingredient_id);
```

One master row (`green onion`) has alias rows pointing at it (`scallions`,
`spring onions`). Resolving a name checks `ingredients.name_key` first, then
`ingredient_aliases.alias_key`, before creating anything. That happens when
saving a recipe, searching in the combobox, and building a grocery list.

- **Part of the shared catalog.** Same RLS as `ingredients`: any signed-in
  user can read and insert; no update or delete policies (bad rows are
  removed by a migration). AGENTS.md's table list is updated to name it next
  to `ingredients`.
- **An alias never shadows a real ingredient.** Before inserting, the app
  checks that `alias_key` isn't some ingredient's `name_key`; the cleanup
  script re-checks. No trigger, per AGENTS.md.
- **Where rows come from** (`source`):
  - `seed`: the synonyms above, added by a migration that matches by name
    and does nothing on a fresh database. Added in **step 7**, not step 2:
    on 2026-11-17 nearly every pair (`scallions` / `green onion`, `feta
    cheese` / `feta`) existed as two separate ingredients, and an alias can't
    share a key with a real ingredient until they're merged.
  - `merge`: when the cleanup merges `onions` into `onion`, the merged-away
    names become aliases of the kept ingredient, so old spellings keep
    resolving instead of being recreated.
  - `ai`: during import and generate. The edge function returns a
    `canonicalName` for each ingredient: the common grocery name for the
    *same* item (`scallions` → `green onion`), or the name itself. If its key
    differs from the name's key, the app uses (or creates) the canonical
    ingredient and inserts an alias row for the name as written.
  - `user`: reserved for a later "this is the same as…" option in the app.
- **Risk.** An `ai` alias applies to every user and every later import, and
  clients can't edit or delete it. A wrong one (e.g. `salted butter` →
  `butter`) would quietly misfile ingredients. Recording `source` makes them
  easy to list and audit; whether they apply immediately or wait for
  approval is an open decision.

**d. How it comes, not what it is.** `basil leaves`, `cilantro leaves`,
`dried thyme leaves`, `parsley sprigs`, `broccoli florets`, `frozen corn
kernels`, `garlic cloves`, `ginger slices`. These words move to notes, or to
the unit when no unit is given (`3 garlic cloves` → quantity `3`, unit
`clove`, name `garlic`). `salmon fillets` merges into `salmon` with a note,
shown in the review mapping.

**e. "X of Y".** `juice of lime` → `lime juice`, `zest of lemon` → `lemon
zest`. `lime juice` stays separate from `lime`, since bottled juice is a
different purchase (cautious rule).

**f. Brand names.** `hershey's cocoa powder`, `duncan hines butter golden
cake mix`, `quaker old fashioned oats`, `stonefire® naan`, `california
walnuts`. A brand list can't be complete, so the prompt says to put brands in
`notes`, and the review mapping flags names containing `®`, `™` or `'s`.

**g. The comma rule is unsafe as written.** "Text after the first comma is
notes" is right for `garlic, minced`, but:

- `broccoli, zucchini, mushrooms, peppers, cauliflower` is a **list of
  ingredients**. It would become `broccoli` with the rest as notes, and four
  vegetables would vanish from the grocery list.
- `chicken thighs, bone in, skin on` has **product words** after the comma.
  It would become `chicken thighs`, while `bone-in chicken thighs` keeps them.

Revised rule: text after a comma moves to notes **only when it's all
size/prep words**. If every part is a known ingredient, it's split into
separate ingredients. Anything else is left as it is and flagged for review.

**h. More words that belong in notes.** Temperature and state: `warm`,
`cold`, `cooled`, `boiling`, `softened`, `melted`, `room temperature`.
Quality: `organic`, `ripe`, `wild-caught`. Added to the notes word list.
`toasted` stays in the name (cautious): `toasted sesame oil` is a product,
even though `toasted pine nuts` usually isn't.

**i. Things that aren't shopping items.**

- **Water:** `water`, `warm water`, `filtered water`, `boiling filtered
  water`. Fine in a recipe, but it shouldn't be on a grocery list. Grocery
  generation skips the `water` ingredient.
- **Placeholders:** `toppings`, `condiments`, `seasoning(s)`, `icing
  ingredients`, `vegetables`, `fresh herbs`. The prompt says not to return
  placeholders; existing ones are flagged in the review mapping.

**j. Parts made inside the recipe.** `mandarin juice reduction` (in a cake
recipe that also lists `mandarins`), `blueberry chia jam` (also lists
`blueberries` and `chia seeds`), `cream sauce base`, `avocado crema`. You
make these from the recipe's other ingredients, so they can't be bought, but
today they're catalog ingredients and land on grocery lists. The same recipes
also list ingredients twice (`vanilla extract`, `unsalted butter`) because
the original had sections like "For the cake" / "For the frosting", which
the app has no place to store.

See open decisions: "Recipe sections and made-in-recipe parts".

### 11. Categories

**What's wrong (2026-11-17).** 206 of 604 ingredients are `other`, including
`garlic`, `onion`, `butter`, `eggs`, `ground beef` and most spices; one has
no category. 200 of them were created on 2026-05-25/26, when the catalog was
first filled from existing recipes, before imports assigned categories. Since
then imports have created only 6 `other` ingredients, so the prompt mostly
works. Two gaps remain:

1. **`other` is permanent.** When an import or a person picks a better
   category for an ingredient that already exists, it's ignored: the match
   returns the existing row, and clients can't update the shared catalog
   (no update policy).
2. **The prompt's descriptions are off in places:** broth and stock are
   filed under `beverages`, and `other` is "only if nothing else fits"
   rather than "not food".

**A category table, keyed by the slug.**

```sql
create table public.ingredient_categories (
  id text primary key,          -- code: 'produce', 'meat_seafood', …
  name text not null,           -- label shown in the app
  description text not null,    -- what belongs here; used in the AI prompt
  sort_order smallint not null  -- grocery list order
);
```

- `ingredients.category` becomes a foreign key to `ingredient_categories.id`,
  replacing today's CHECK list.
- **Decided: the key is a short code, not a `category_id`.** A code is the
  usual key for a small fixed lookup table (like country or currency codes):
  the AI returns it reliably (it can't return a uuid), SQL and the grocery
  code read it directly, and the label lives in `name`, so renaming what the
  app shows never touches the key. The current values contain spaces and
  `&`, so they're cleaned once: `produce`, `meat_seafood`, `dairy_eggs`,
  `bakery_bread`, `pantry`, `frozen`, `beverages`, `other`. The migration
  rewrites `ingredients.category` and `grocery_items.category` to the new
  codes (matched exactly on the old values, so a fresh database is
  unaffected), and the `IngredientCategory` type changes to match.
- Read-only for signed-in users; changed only by migrations. It's a small,
  fixed lookup table, listed in AGENTS.md next to the catalog.
- **Why a table rather than a constant in the app:** the edge function
  (Deno, deployed separately) can't import from `src/`, so a TypeScript
  constant would have to be copied into the prompt and kept in sync by hand,
  as the 8 names are today. With a table, the descriptions the AI reads and
  the labels the app shows have one source, and a category can be added or
  reworded with a migration.
- Descriptions are written for the store aisle, e.g. `pantry`: canned and
  jarred goods, dry pasta, rice, grains, flour, sugar, spices, oils, vinegar,
  sauces, condiments, nuts, seeds, **broth and stock**; `other`: non-food
  items only (foil, skewers, toothpicks).

**A categories module inside `ingredients`:** `features/ingredients/
categories/` with its types, `api.ts` (list the table), and `queries.ts`
(cached for the session; the list barely changes). Categories are an
attribute of catalog ingredients, and grocery and recipes already depend on
`ingredients`, so no new feature boundary is needed. The `IngredientCategory`
id type stays for type safety; labels, order and descriptions come from the
table, replacing the copies in `ingredients/types.ts` and
`grocery/utils/groceryGeneration.ts`.

**Import and generate.** The edge function reads the table with the
signed-in user's token and builds the category enum and rules from it, with
examples for the common misses (garlic → produce, butter → dairy & eggs,
ground beef → meat & seafood, cumin → pantry, chicken broth → pantry).

**Upgrading `other`.** A function `upgrade_ingredient_category(ingredient_id,
category)`, `security definer`, changes a row **only if it is currently
`other` or empty**, and never moves an ingredient between two real
categories. `resolveIngredients` calls it when an import or the combobox
supplies a real category for a matched `other` ingredient. Any signed-in user
can call it, which is acceptable because it can only improve an
uncategorized row.

**One-time fix.** After the step 7 merges, every remaining `other`
ingredient gets an AI-proposed category (from the same descriptions) in a
review file; approved rows are applied by a migration matched by name, and
`ingredients.category` becomes `not null`.

## Steps

Each is its own commit; the app works after every one.

1. **Naming and unit module + tests.** The `ingredients/utils` naming
   module and `normalizeUnit`, with unit tests using real names and units from the data
   as fixtures, plus the junk-value cleanup. Includes the space-free key,
   form words (leaves, florets, cloves), "X of Y", the revised comma rule,
   and the extra notes words (section 10). No alias data: aliases live in
   the `ingredient_aliases` table. No behavior change.
2. **Expand: `name_key` column** (nullable, plain index), backfilled for the
   604 existing names by a migration generated with `ingredientKey`.
   `createIngredient`, `searchIngredients` (escaped, matches name or key) and
   new `resolveIngredients` read and write it, with a fallback to `name` for
   rows saved without a key. **Alias table** migration (`ingredient_aliases`
   with RLS, empty: seeds move to step 7); `resolveIngredients` and search
   check approved aliases after names. Recipe saving resolves all its new
   ingredients in one batch. Combobox hides "Add new" on a key or alias
   match, showing e.g. "green onion (scallions)". AGENTS.md names the alias
   table as part of the shared catalog. Regenerate types. **Done.**
3. **Ingredient order and atomic save.** Migration adding `position`
   (backfilled) and the `save_recipe_ingredients` function; recipes save
   through it and load sorted by `position`. Units normalized on save.
   A new recipe whose ingredients fail to save is removed again, so no
   empty recipe is left behind. **Done.**
4. **Substitutes.** Migration for `substitute_for` with the same-recipe
   composite key + index; save, load, recipe view, form, scaling, grocery
   filter. **Done.**
5. **Import/generate.** Edge function prompt and schema moved to their own
   module; prompt rules (cautious merge rule, prep and size in `notes`, no
   `"null"` text, brands in `notes`, no placeholders, list each ingredient
   separately, list only what you buy, worked examples), `substitutes` and
   `canonicalName` in the response schema. Deploy the function first. Then
   the app: safety-net parsing in `recipeImport.ts`, `ai` alias rows from
   `canonicalName`, matched/new labels in the draft form, a "N new" count on
   the Create path.
6. **Grocery merge on `ingredient_id` + normalized unit.** Update
   `mergeIngredients`, the grocery API select, tests, and AGENTS.md. Skip
   `water`. Substitutes as options: `grocery_items.substitutes` migration,
   attach and merge them in generation, and the "N options" toggle on items.
7. **Cleanup script → reviewed mapping → data migration.** Names, notes,
   units, junk values, "or" rows, merges; matched by name; collision check.
   Merged-away names become `merge` alias rows of the kept ingredient; the
   `seed` synonyms are added once their pairs are merged.
8. **Contract:** `name_key not null unique`; drop the fallback to `name`.
   Remove `recipe_ingredients.ingredient_name`: recipe detail and grocery
   generation read the name from `ingredients` (the grocery query already
   joins it for the category), saving stops writing it, then a migration
   drops the column. Regenerate types.
9. **Categories** (section 11). Migration: `ingredient_categories` table
   seeded with the 8 categories (cleaned codes) and their descriptions,
   existing `ingredients` / `grocery_items` values rewritten to the codes,
   `ingredients.category` becomes a foreign key to it, and the
   `upgrade_ingredient_category`
   function. Categories module in `features/ingredients/categories/`;
   grocery and the combobox read labels and order from it. Edge function
   builds its category list and rules from the table. Then the one-time
   recategorization: AI-proposed mapping for every `other` ingredient,
   reviewed, applied by a migration matched by name; `category` becomes
   `not null`.

Steps 1–6 can merge to `main` before the cleanup; the cleanup (7–8) needs
the review in between. Step 9 runs last, so it recategorizes the merged
catalog instead of every duplicate.

## Open decisions

- ~~How aggressive the merge is.~~ **Decided: cautious** (see "Cautious
  merge rule"). The edge function follows the same rule.
- ~~AI-created aliases: apply now or wait for approval?~~ **Decided: 3**
  (apply only when safe). Needs a `status` column (`approved` / `pending`)
  on `ingredient_aliases`; only approved rows resolve. (Alias table.)
  1. *Apply immediately* (`source = 'ai'`), audited later with a query
     listing `ai` rows. Simplest; a wrong alias misfiles ingredients until
     someone notices.
  2. *Pending until approved:* add `status` (`pending`/`approved`); only
     approved rows resolve. Safer, but there's no admin screen, so approving
     means running SQL, and until then "scallions" still creates its own
     ingredient.
  3. *Apply only when safe:* apply immediately when the canonical name is
     already in the catalog **and** in the same category; otherwise save it
     as pending.

  Proposed: 3.
- ~~The 19 unused ingredients.~~ **Decided: delete them** in the step 7
  cleanup. Re-checked at cleanup time: only ingredients no
  `recipe_ingredients` row and no alias points at are deleted.
- ~~`recipe_ingredients.ingredient_name`.~~ **Decided: remove it** (step 8).
  It duplicates the catalog name that `ingredient_id` already points to, so
  merges and renames would have to rewrite every recipe row, and grocery
  lists merge on it instead of the ingredient. After the cleanup the cleaned
  name is the catalog name and size/prep words are in `notes`, so the copy
  adds nothing. Recipes and grocery lists read the name from `ingredients`
  instead. Saved grocery lists keep their own text on purpose (a snapshot).
- ~~Atomic save.~~ **Decided: Postgres function** `save_recipe_ingredients`,
  called with `supabase.rpc`, `security invoker` so RLS applies (step 3).
  supabase-js can't group separate requests into one transaction, and an
  edge function with a direct connection would bypass RLS.
- ~~Display name for merged ingredients.~~ **Decided: singular by default**
  (`onion`), with an exceptions list in the naming module for things
  normally written in the plural (`eggs`, `oats`, `cherry tomatoes`, …).

- ~~Recipe sections and made-in-recipe parts~~ (section 10j). Options:
  1. *Prompt only:* tell the model to list only ingredients you buy, and
     to fold sections into one list. Cheapest, but loses "For the frosting"
     and doesn't fix existing recipes.
  2. *Sections:* add a nullable `section text` column to
     `recipe_ingredients` ("Cake", "Frosting"). The recipe view groups by
     it, and the prompt returns it. Made-in-recipe parts are left out of the
     ingredient list, since their ingredients are already in other sections.
  3. *Sections plus a "made in this recipe" flag* on a row, so it can stay
     in the list for reading but is skipped on grocery lists.

  **Decided:** the prompt rule from 1 goes in step 5 now (list only what
  you buy; parts made during the recipe are described in the instructions).
  Sections (option 2) are a **separate project** after this plan. The
  cleanup flags existing made-in-recipe parts for review.

Data facts behind these (2026-11-17): one user has recipes, so the cleanup
only rewrites that user's rows. The catalog is shared, so the naming rules
apply to future users too.

## Verification

- Unit tests for every naming function, `resolveIngredients`, substitute
  save/load, and the grocery filter; one component test walking "add
  ingredient → add substitute → save".
- RLS: as one user, insert a substitute row on own recipe (allowed) and on
  another user's recipe (denied); read only own substitute rows. Try to
  point a substitute at a row in a different recipe (rejected by the
  composite key). Call `save_recipe_ingredients` on another user's recipe
  (rejected).
- Atomic save: make the insert fail partway (e.g. a bad `ingredient_id`) and
  confirm the recipe keeps its previous ingredients.
- Aliases: importing "scallions" when `green onion` exists links to it and
  adds an `ai` alias row; a second import of "spring onions" resolves
  through the seed row with no new ingredient; an alias whose key equals an
  existing ingredient's key is refused. RLS: signed-in users can read and
  insert aliases but not update or delete them.
- Categories: importing "garlic" when `garlic` is `other` upgrades it to
  `produce`; importing it again as `pantry` does not move it; anonymous users
  can't read `ingredient_categories` and nobody can write it from the app;
  after the fix no ingredient is `other` unless it's non-food.
- Run all migrations on a fresh local database (`supabase db reset`) to
  confirm the cleanup migration is a no-op there.
- Before/after counts from the cleanup: catalog size, recipe rows per
  recipe unchanged except for added substitutes, no orphaned
  `ingredient_id`.
- Manual: import a recipe with "olive or avocado oil" and "garlic, minced";
  generate one; edit an existing recipe; build a grocery list from a week
  that uses both `onion` and `onions` recipes.
