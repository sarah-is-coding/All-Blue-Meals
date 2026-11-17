# Meal planning data model redesign

Status: **Proposed**. Nothing here is implemented yet.

## Summary

Remove the `meal_plans` container. Planned meals belong to the user and a
date, not to a plan. Saved plans become frozen copies, created only when the
user saves. Grocery lists are built from a date range or from a saved plan.

## Why

Today every planned meal (`meal_plan_items`) belongs to a `meal_plans` row,
and each row is effectively "a week" (looked up by `start_date = Monday`).
That causes:

1. **Ambiguous week lookups.** Nothing stops two plans starting the same
   Monday, and the app silently uses the oldest. Meals attached to the other
   are invisible on the planner and missing from grocery lists.
2. **Plans are stuck at one week.** A 2-week plan starting Nov 2 isn't found
   when viewing the week of Nov 9, and adding a meal on Nov 10 creates a
   second, overlapping plan.
3. **Saved plans are live, not saved.** Saving a week just names that week's
   plan row. Editing that week on the calendar later changes the saved plan,
   and "Replace existing" on that week deletes the saved plan's meals.
4. **Plan creation as a side effect.** The first meal added to a week creates
   that week's plan, so two simultaneous adds can race.

The meals-by-date reads added in `4a7ee91` (`listMealPlanItemsBetween`)
already treat the calendar as "meals by date". This redesign makes the data
model match.

## Decisions

| # | Decision |
|---|---|
| 1 | **Saved plans are frozen copies.** Saving copies the chosen meals into the saved plan. Later calendar edits never change it, and only editing the saved plan itself does. |
| 2 | **Grocery lists have two sources:** a date range on the calendar, or a saved plan. A list built from a saved plan uses the plan's own (frozen) meals, not whatever is on the calendar for its original dates. |
| 3 | **"Past weeks" becomes "copy a date range".** Pick any range, preview its meals, then copy them to another date or save them as a plan. |
| 4 | **Week `title` and `notes` are dropped.** The app only ever wrote an automatic "Week of …" title and never displayed either field. |
| 5 | **Meals with an `other` or empty meal type are deleted.** The app never shows them, so they're invisible today. |
| 6 | **Saved plans can only be renamed** (and deleted) for now. Editing their meals can come later. |
| 7 | **Rename to match the model:** `meal_plan_items` → `planned_meals`, and the saved copy's rows are `saved_plan_meals` (not "items"). Code follows the same words (see Naming). |
| 8 | **Weeks start on Sunday.** Wherever the app uses the idea of a week (the planner's week view, "This week" / "Next week" shortcuts, default ranges), it runs Sunday to Saturday. The data model doesn't depend on weeks, so this is a display change. See [Weeks start on Sunday](#weeks-start-on-sunday). |

## New data model

```
planned_meals                       -- today's meal_plan_items, without meal_plan_id
  id                uuid pk
  user_id           uuid not null → auth.users        (RLS: user_id = auth.uid())
  planned_for       date not null
  meal_type         text not null check (breakfast | lunch | dinner)
  recipe_id         uuid null → recipes (on delete set null)
  servings_override int null check (> 0)
  created_at        timestamptz not null default now()
  index (user_id, planned_for)

saved_plans
  id                uuid pk
  user_id           uuid not null → auth.users        (RLS: user_id = auth.uid())
  name              text not null, unique (user_id, name)
  source_start_date date not null    -- the range it was saved from (shown, and the
  source_end_date   date not null    --   default start when applying)
  created_at        timestamptz not null default now()

saved_plan_meals                    -- the frozen copy, stored as day offsets
  id                uuid pk
  saved_plan_id     uuid not null → saved_plans (on delete cascade)
                                     -- RLS: via saved_plans.user_id
  day_offset        int not null check (>= 0)   -- 0 = first day of the plan
  meal_type         text not null check (breakfast | lunch | dinner)
  recipe_id         uuid null → recipes (on delete set null)
  servings_override int null check (> 0)

grocery_lists                       -- existing table
  - meal_plan_id
  + start_date      date null        -- set when built from a date range
  + end_date        date null
  + saved_plan_id   uuid null → saved_plans (on delete set null)
                                     -- set when built from a saved plan
```

Day offsets (rather than dates) let a saved plan be applied starting on any
date, and work the same for any length.

## Behaviour

| Action | New behaviour |
|---|---|
| View a week on the planner | Planned meals with `planned_for` in that week (already how reads work). |
| Add, move, remove, or change servings on the planner | Each changes just that one meal. Adding no longer has to find or create a week's plan first, and moving no longer leaves the meal attached to its old week's plan. |
| Save as plan | Ask for a name and a date range; copy those meals into `saved_plans` / `saved_plan_meals` with offsets from the range start. |
| Apply a saved plan | Ask for a start date (defaults to the plan's source start) and Add or Replace. Insert each item at start + offset. Replace first removes planned meals in the target range. |
| Copy a date range | Pick a source range, preview it, pick a target start date; same as applying, without saving. |
| Grocery list from a date range | Planned meals in the range → ingredients (uses `listMealPlanItemsBetween`). Saved with `start_date` / `end_date`. |
| Grocery list from a saved plan | That plan's frozen items → ingredients. Saved with `saved_plan_id`. |
| Delete a saved plan | Deletes the copy only. Calendar meals are unaffected. |

## Naming

A row is one meal scheduled on one date for one person, so it's a
**planned meal** (the planner's own word, and it's "planned for" a date).
"Items" only made sense as items of a `meal_plans` container.

| Today | After | Notes |
|---|---|---|
| table `meal_plan_items` | `planned_meals` | |
| (new) | `saved_plans`, `saved_plan_meals` | Created with these names |
| `MealPlanItem`, `MealPlanItemRow` | `PlannedMeal`, `PlannedMealRow` | |
| `items`, `mealPlanItemId`, `MEAL_PLAN_ITEM_COLUMNS` | `meals` / `plannedMeals`, `plannedMealId`, `PLANNED_MEAL_COLUMNS` | Variables and arguments |
| `listMealPlanItemsBetween` | `listPlannedMealsBetween` | |
| `listMealPlanItemsForPlan` | `listSavedPlanMeals` | "For plan" now means a saved plan |
| `PastMealPlanPanel`, `PlanSpanCalendar`, `MealPlanSpan`, `useMealPlanSpans` | Replaced in step 2c | The concept (listing week plans) goes away with "copy a date range" |
| `meal-plans` folder, `MealPlannerCalendar`, `MealPlansPage`, `mealPlannerViewState` | Unchanged | Still about meal planning, not the old container |
| `SavedMealPlan`, `SavedMealPlansPage`, `useSavedMealPlans` | Unchanged | Saved plans still exist |

Today the old names appear about 130 times across 8 source and 7 test files
(almost all `MealPlanItem`). No file is named after "items".

## Weeks start on Sunday

Today a week runs Monday to Sunday. Under the new model meals are stored by
date, so switching to Sunday needs no data migration: it only changes which
dates a "week" covers on screen.

**When:** after step 2d. Until then, adding a meal still finds or creates
"the plan starting this week" (by its Monday); switching earlier would create
a second, Sunday-starting plan for every week.

**Where** (all Monday-first today):
- `getWeekStartIso` in `src/lib/utils/dates.ts` (and its tests): the single
  definition of a week's start. Everything below derives from it.
- The planner calendar's day columns (from `getWeekDays`) and "Current week".
- The grocery page's "This week" / "Next week" shortcuts and default range.
  These already derive from `getWeekStartIso`, so they switch automatically.
  Don't switch them ahead of the planner: "this week" must mean the same days
  on both screens, or a grocery list would include last Sunday's meals and
  miss this Sunday's.
- `PlanSpanCalendar` (`Mo … Su` headers, `monFirstDow`): removed in step 2c,
  so it doesn't need changing; its replacement should start on Sunday.
- `getPlannerStartWeek` rounds a remembered week to its start, so a
  remembered Monday becomes the preceding Sunday automatically.

## Migration plan (expand → switch → contract)

The production database has real data, so every step keeps the app working
and, until the final step, can be rolled back.

1. **Expand** (one migration, additive only:
   `20261115120000_expand_for_planned_meals.sql`):
   - Add `user_id` to `meal_plan_items` (defaulting to the signed-in user, so
     the current app needs no change), backfill it from `meal_plans.user_id`,
     add the `(user_id, planned_for)` index, and make `meal_plan_id` optional.
   - Replace the plan-based RLS policy with **one combined policy**: rows are
     visible only to their owner, and a meal can only be attached to a plan the
     same user owns. (Two separate permissive policies would be OR-ed, letting
     someone attach a meal to another user's plan.)
   - Create `saved_plans` / `saved_plan_meals` with RLS, **empty**. Existing
     saved plans are copied in step 2b, released together with the code that
     uses them, so the copy is current.
   - Add `start_date`, `end_date` and `saved_plan_id` to `grocery_lists`;
     backfill the range from each list's plan (re-run in step 2a for lists
     created in between).
   - Regenerate types. The current app still works unchanged.
2. **Switch the app over**, one area per commit, each with tests. The order
   matters: three features still need every week with meals to have a
   `meal_plans` row (the past-weeks calendar lists plan rows, "Save as meal
   plan" names a plan row, and grocery lists link to the week's plan row). So
   the planner keeps creating week plans, exactly as today, until those
   features have moved off them; only then does it stop (2d). The app works
   fully after every step. Saved plans move first (2b) because the past-weeks tab
   is where plans are saved; replacing that tab first (2c) would leave no way
   to save a plan in between.
   - **2a. Grocery page:** pick a date range or a saved plan. Lists save their
     range (`start_date` / `end_date`) or `saved_plan_id` instead of a plan
     link; re-run the step 1 range backfill for lists created in between.
   - **2b. Saved plans move to the new tables:** a migration released with this
     step copies existing saved plans into `saved_plans` / `saved_plan_meals`;
     "Save" asks for a date range and "Apply" places meals from a chosen start
     date. The past-weeks tab's "Save as meal plan" passes the selected week's
     dates, so saving keeps working until 2c replaces that tab.
   - **2c. "Copy a date range"** replaces the past-weeks panel. It finds the
     dates you have meals on directly instead of listing plan rows (removing
     the plan-span names listed under Naming), and offers "Save as meal plan"
     for the chosen range using 2b's save.
   - **2d. The planner stops creating week plans.** Adding a meal just saves it
     with `user_id` and its date. Safe now that nothing reads week plans.
   - **Then: weeks start on Sunday** (decision 8), as its own commit. Safe
     once 2d is done; see [Weeks start on Sunday](#weeks-start-on-sunday).
   - **2e. Rename**, as its own commit containing nothing else: the migration
     renaming `meal_plan_items` → `planned_meals` and the code renames above.
     No behaviour changes. Both go in the same commit because a table rename
     breaks any app version still using the old name, so they must deploy
     together. `tsc` lists every remaining use of an old type or function
     name; tests confirm behaviour is unchanged.
3. **Contract**, only after running fine in production. This is the one
   irreversible step:
   - Delete meals whose meal type is `other` or empty (decision 5), after a
     read-only query has listed exactly which rows that is.
   - Drop `meal_plan_items.meal_plan_id`, `grocery_lists.meal_plan_id` and the
     `meal_plans` table.
   - Make `meal_type` and `user_id` `not null`.
