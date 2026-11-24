# Meals made of several recipes

Status: **Proposed**. Nothing here is implemented yet.

## Summary

A real meal is often several recipes: a main, a side, a dessert, plus a
marinade or sauce that the main needs. Today each one is planned and opened
on its own. This plan makes "a meal" something the app shows and opens as
one thing, then lets a recipe include its marinade or sauce, and (later, if
needed) lets you save a group of recipes you often make together.

## Why

The planner stores one `planned_meals` row per recipe per slot (a date plus
breakfast, lunch or dinner). Nothing ties the rows in a slot together, so:

1. **The planner fills up.** Each recipe in a slot is a full card with a
   servings stepper and a Remove button. A dinner of four recipes is four
   cards.
2. **Cooking means jumping between pages.** Each recipe opens on its own
   page; there's no view of the whole meal, its combined ingredients, or
   which part needs to start early (the marinade).
3. **Parts of a dish are planned by hand every time.** The kebabs' marinade
   and tzatziki are separate recipes, so they have to be added to the slot
   each time, and the grocery list misses them if you forget.

## Two kinds of extra recipe

| Kind | Examples | How it's tied to the meal | Handled by |
|---|---|---|---|
| **Parts of a dish** | marinade, sauce, dressing, spice rub | Always made with one particular main | Phase 2: recipes include other recipes |
| **Dishes that go with it** | side, salad, dessert, drink | Picked fresh for each meal | Phase 1: a meal is shown and opened as one thing |

## Decisions

| # | Decision |
|---|---|
| 1 | **A meal is the slot, not a new table.** The recipes planned for one date and meal type are that meal. Phase 1 needs no database change. |
| 2 | **One card per meal, everywhere.** The planner, the home page, and previews show a meal as one compact card ("Lamb kebabs + rice + baklava"), not one card per recipe. |
| 3 | **A meal page** at `/meals/:date/:mealType` shows every recipe in the meal, their combined ingredients, tags (marinate first) and notes. It's where you change servings or remove a recipe from the meal. |
| 4 | **The main comes first, with no new column at first.** The order comes from tags: dessert, side, salad, drink and sauce tags move a recipe after the others; otherwise it's the order added. A `role` column is added only if tags turn out not to be enough (see Open questions). |
| 5 | **The meal page lives in `src/app/`**, next to the home page, because it combines meal plans and recipes. (`meal-plans` may not import `recipes`, and the page isn't a recipe page.) |
| 6 | **Sub-recipes are a separate table, one level deep.** `recipe_components` links a recipe to the recipes it includes. A component can't have components of its own, so there's no cycle to guard against and no recursion in grocery lists. |
| 7 | **Saved meal combos wait** until Phases 1 and 2 are in use. Build them only if the same groups keep getting re-planned. |

## Phase 0: groundwork (no visible change)

Small refactors so Phase 1 changes one well-tested place instead of several.
Each is its own commit, and the existing tests must pass unchanged.

1. **A shared idea of a meal** in `src/features/meal-plans/utils/mealSlots.ts`:
   - `MealSlot` type: `{ dateIso, mealType, meals: PlannedMeal[] }`
   - `groupMealsBySlot(meals)`, and the breakfast → lunch → dinner order, used by:
     - the planner (replaces `slotMap` in `MealPlannerCalendar.tsx`)
     - the home page (replaces `MEAL_ORDER` / `mealsOn` in `src/app/home/homeMeals.ts`)
   - Unit tests for grouping and ordering.
2. **Split the planner's recipe card** out of `MealPlannerCalendar.tsx` (356 lines)
   into `PlannedMealChip.tsx`: servings stepper, Remove, dragging. The
   five-condition "busy" check that's copied twice becomes one value. Phase 1
   replaces how a slot's cards are arranged, so it should be its own component
   first.
3. *(Optional)* **Split `meal-plans/api.ts`** (469 lines) into an `api/` folder
   with an `index.ts`, as CLAUDE.md asks for data files past ~300 lines.
   It's worth doing before Phase 1 if a `role` column is added, since that
   touches every insert and select in the file.

## Phase 1: one card and one page per meal

### 1a. A read-only recipe view
`RecipeReadArticle` takes the edit form's text fields, and the serving-size
logic lives inside `RecipeDetailPage` (290 lines). The meal page needs to show
several recipes without faking a form for each.

- New `RecipeView` component in `recipes/components`: takes a `RecipeDetail`
  and a serving count, and shows the scaled ingredients and steps.
- `RecipeDetailPage` uses it for reading, so the existing recipe page tests
  cover it.
- Pull the "servings this visit" state into a small hook (`useRecipeServings`)
  that the recipe page and the meal page both use.

### 1b. The meal page (`/meals/:date/:mealType`)
- **Data:** the slot's meals come from `listPlannedMealsBetween(date, date)`
  (see "Which meals count" in CLAUDE.md). Each recipe comes from the existing
  `useRecipe` cache, so nothing loads twice.
- **Header:** date, meal type, total time of the longest recipe, and a
  marinate reminder if any recipe has a marinate tag.
- **Recipes:** one section per recipe, main first (Decision 4). On phones, a
  row of tabs at the top; on wide screens, stacked sections.
- **Ingredients:** a combined list, grouped by recipe (not merged: when
  cooking you need to know which bowl each one goes in).
- **Per recipe:** servings stepper and Remove (moved here from the planner
  card), latest note and Add note (the note UI from `LastMealCard`), and a
  link to the full recipe page.
- **States:** loading (`LoadingModal`), empty ("Nothing planned for this
  meal" with Search recipes), recipe deleted, error.
- A shared `mealPath(dateIso, mealType)` helper, like `recipePath`.

### 1c. The planner shows one card per meal
- Each slot shows one compact card: the main's title, then "+ rice, baklava"
  (or "+2 more" when long), and the total servings if they differ.
- Tapping it opens the meal page. Servings and Remove move there, so the
  planner card stays small.
- "Search recipes" stays on the slot, to add to the meal.
- Dragging moves the whole meal to another slot; moving one recipe is done
  from the meal page. (See Open questions.)
- Picker mode (choosing a slot when adding a recipe) shows the same compact
  card, read-only.

### 1d. The home page shows one card per meal
- `MealPreviewCard` becomes a meal card: the meal's recipes, their combined
  meats and tags (marinate first), and the latest note per recipe.
- "Open meal" goes to the meal page; each recipe title still links to its
  recipe.
- `useHomeReady` already waits on every recipe and note shown; it just
  receives meals grouped by slot.
- The Last meal card rates and notes each recipe in yesterday's meal, or just
  the main (see Open questions).

### Phase 1 tests
- `groupMealsBySlot` and tag-based ordering: happy path, empty, a slot whose
  recipe was deleted, ties.
- `RecipeView`: render, scaling, a recipe with no ingredients.
- Meal page: render, servings change and Remove (mocked `meal-plans/api`),
  empty, deleted recipe, error. One test that walks planner card → meal page →
  change servings → back.
- Planner: one card per slot, tap opens the meal page, drag moves the meal.
- Home: one card per meal, combined meats and tags.

## Phase 2: recipes that include other recipes

### Data model
```
recipe_components
  id                   uuid pk
  recipe_id            uuid not null → recipes (on delete cascade)   -- the main
  component_recipe_id  uuid not null → recipes (on delete cascade)   -- e.g. the marinade
  batches              numeric not null default 1 check (> 0)        -- "1 batch tzatziki"
  position             int not null default 0
  unique (recipe_id, component_recipe_id)
  check (recipe_id <> component_recipe_id)
  index (recipe_id), index (component_recipe_id)
```
- **RLS:** a child table, owned through its parent (AGENTS.md pattern):
  select/insert/update/delete only when `recipes.user_id = auth.uid()` for
  `recipe_id`, and insert/update only when the component recipe is also the
  user's.
- **One level deep:** saving a component fails if the component has
  components of its own, or if the main is itself used as a component. This is
  checked in the app and enforced in the database (a check in the insert
  policy, or a small function), so the grocery list and scaling never need
  recursion.
- `recipe_ingredients` is unchanged: every ingredient row still points at a
  catalog ingredient.

### Behaviour
- **Recipe page:** a "Made with" section lists the components with links.
  You can add one by searching your recipes and setting the batches.
- **Planning:** adding the main to a meal brings its components with it. They
  show on the meal page as part of the main (tabs: Kebabs · Marinade ·
  Tzatziki), not as separate dishes.
- **Scaling:** a component scales with its main. Doubling the kebabs' servings
  doubles the marinade's batches.
- **Grocery lists:** a planned main adds its components' ingredients
  (batches × the main's scale), merged by the existing rules in
  `groceryGeneration.ts`. The component rows are loaded with the same
  `.in("recipe_id", …)` query, so it's still one request.
- **Marinate reminders carry up:** if a component has a marinate tag, the
  main's cards and the meal page show the marinate reminder too.
- **Deleting a component recipe** removes the link (cascade). The recipe page
  says "Used in 2 recipes" before you delete.
- **AI import, later:** when a source has a "For the marinade" section, offer
  to save it as its own recipe and link it as a component.

### Phase 2 tests
- API: add/remove/list components (table, filters, mapped values); the
  one-level rule.
- Grocery: a main with a component merges both ingredient lists, scaled;
  duplicate ingredients across main and component merge into one line.
- Scaling: batches follow the main's servings.
- RLS, by hand: you can't link another user's recipe as a component, and
  can't read another user's links.

## Phase 3: saved meal combos (only if needed)

Sketch, to be revisited after Phases 1 and 2 are in use:

```
meal_combos        id, user_id, name, created_at          (RLS: user_id = auth.uid())
meal_combo_recipes id, meal_combo_id, recipe_id, servings_override, position
                                                          (RLS through meal_combos)
```
- "Save as combo" on the meal page; "Add combo" when filling a slot.
- Behaves like saved plans: a frozen copy, so editing a combo never changes
  meals already planned.

## Open questions

1. **Are tags enough to put the main first?** If not, add a nullable `role`
   (main | side | dessert | sauce | drink) to `planned_meals` and
   `saved_plan_meals`, carried by copy, save-as-plan and apply-plan. Decide
   after using Phase 1 for a while.
2. **Dragging on the planner:** move the whole meal (proposed), or let a
   single recipe be dragged out of the compact card?
3. **Last meal card:** rate and note every recipe in yesterday's meal, or
   only the main?
4. **Are marinades and sauces always tied to one main?** If you mix and match
   them across dishes, Phase 2 matters less and per-meal planning (Phase 1)
   covers it.
5. **Servings:** should a meal have one servings number that every recipe
   follows, with per-recipe overrides? Proposed: keep per-recipe servings as
   today, shown together on the meal page.

## Order of work

| Step | What | Database change | Size |
|---|---|---|---|
| 0.1 | Shared meal grouping (`mealSlots.ts`) | none | small |
| 0.2 | `PlannedMealChip` split out of the planner | none | small |
| 0.3 | *(optional)* `meal-plans/api/` folder | none | small |
| 1a | `RecipeView` + `useRecipeServings` | none | medium |
| 1b | Meal page | none | medium |
| 1c | One card per meal in the planner | none | medium |
| 1d | One card per meal on the home page | none | small |
| 2 | Recipe components | new table + RLS | large |
| 3 | Saved meal combos | new tables + RLS | medium, only if needed |

Each step is its own commit with its tests. Phase 1 can ship and be used
before Phase 2 starts.
