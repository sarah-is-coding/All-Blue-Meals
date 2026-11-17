import { supabase } from "../../lib/supabaseClient";
import type { Tables } from "../../lib/db/database.types";
import {
  addDays,
  createDateFromIso,
  getWeekEndIso,
  toIsoDate,
} from "../../lib/utils/dates";
import type {
  AddPlannedMealInput,
  MealPlanDayPreview,
  PlannedMeal,
  MovePlannedMealInput,
  MealType,
  SavedMealPlan,
  UpdatePlannedMealServingsInput,
} from "./types";
import { groupMealsByDay } from "./utils/groupMealsByDay";

type RecipeRelationRow = Pick<Tables<"recipes">, "title" | "servings">;

type RecipeRelation = RecipeRelationRow | RecipeRelationRow[] | null;

type PlannedMealRow = Pick<Tables<"planned_meals">, "id" | "recipe_id" | "planned_for" | "servings_override"> & {
  // meal_type is a NOT NULL text column whose CHECK constraint allows only
  // breakfast, lunch and dinner (since the contract step); narrow to those.
  meal_type: MealType;
  recipes: RecipeRelation;
};

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner"];

function getRecipeRelationValue(relation: RecipeRelation): RecipeRelationRow | null {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }
  return relation;
}

function getRecipeTitle(relation: RecipeRelation): string {
  return getRecipeRelationValue(relation)?.title ?? "Untitled recipe";
}

function getRecipeServings(relation: RecipeRelation): number | null {
  return getRecipeRelationValue(relation)?.servings ?? null;
}

function mapPlannedMealRow(row: PlannedMealRow): PlannedMeal {
  // The database guarantees this; the guard catches a schema that drifts.
  if (!MEAL_TYPES.includes(row.meal_type)) {
    throw new Error("Unsupported meal type on planned meal.");
  }
  const mealType = row.meal_type;
  const recipeServings = getRecipeServings(row.recipes);
  const servingsOverride = row.servings_override;
  const effectiveServings = servingsOverride ?? recipeServings;

  return {
    id: row.id,
    recipeId: row.recipe_id,
    recipeTitle: getRecipeTitle(row.recipes),
    plannedFor: row.planned_for,
    mealType,
    servingsOverride,
    recipeServings,
    effectiveServings,
  };
}

// ── Which meals count ────────────────────────────────────────────────────
// One definition of "the meals planned for a span of time", shared by the
// planner, grocery lists, previews, copying, and saving plans, so they always agree.

const PLANNED_MEAL_COLUMNS =
  "id,recipe_id,planned_for,meal_type,servings_override,recipes(title,servings)";

/** Every meal the user has planned between two dates (inclusive), from any of
 *  their plans, limited to the meal types the app shows. Dates decide what's in
 *  a week, not which plan a meal belongs to, so this keeps working when plans
 *  can be longer than a week. RLS scopes rows to the signed-in user. */
export async function listPlannedMealsBetween(
  startIso: string,
  endIso: string
): Promise<PlannedMeal[]> {
  const { data, error } = await supabase
    .from("planned_meals")
    .select(PLANNED_MEAL_COLUMNS)
    .gte("planned_for", startIso)
    .lte("planned_for", endIso)
    .in("meal_type", MEAL_TYPES)
    .order("planned_for", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<PlannedMealRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapPlannedMealRow);
}

/** The meals shown on the planner for the week starting `weekStartIso`. */
export async function listPlannedMealsForWeek(weekStartIso: string): Promise<PlannedMeal[]> {
  return listPlannedMealsBetween(weekStartIso, getWeekEndIso(weekStartIso));
}

/** Save one planned meal. It belongs to the user (the column defaults to the
 *  signed-in user) and its date — there is no week plan to attach it to
 *  (redesign step 2d). */
export async function addPlannedMeal(input: AddPlannedMealInput): Promise<PlannedMeal> {
  const { data, error } = await supabase
    .from("planned_meals")
    .insert({
      recipe_id: input.recipeId,
      planned_for: input.plannedFor,
      meal_type: input.mealType,
      servings_override: input.servingsOverride,
    })
    .select("id,recipe_id,planned_for,meal_type,servings_override,recipes(title,servings)")
    .single<PlannedMealRow>();

  if (error) {
    throw new Error(error.message);
  }

  return mapPlannedMealRow(data);
}

export async function deletePlannedMeal(itemId: string): Promise<void> {
  const { error } = await supabase.from("planned_meals").delete().eq("id", itemId);
  if (error) {
    throw new Error(error.message);
  }
}

export async function movePlannedMeal(input: MovePlannedMealInput): Promise<PlannedMeal> {
  const { data, error } = await supabase
    .from("planned_meals")
    .update({
      planned_for: input.plannedFor,
      meal_type: input.mealType,
    })
    .eq("id", input.itemId)
    .select("id,recipe_id,planned_for,meal_type,servings_override,recipes(title,servings)")
    .single<PlannedMealRow>();

  if (error) {
    throw new Error(error.message);
  }

  return mapPlannedMealRow(data);
}



export async function updatePlannedMealServings(
  input: UpdatePlannedMealServingsInput
): Promise<PlannedMeal> {
  const { data, error } = await supabase
    .from("planned_meals")
    .update({
      servings_override: input.servingsOverride,
    })
    .eq("id", input.itemId)
    .select("id,recipe_id,planned_for,meal_type,servings_override,recipes(title,servings)")
    .single<PlannedMealRow>();

  if (error) {
    throw new Error(error.message);
  }

  return mapPlannedMealRow(data);
}

// ── Copying meals to other dates ────────────────────────────────────────────
// Used by "Copy to current week" (meals from other dates) and applying a saved
// plan. Each meal keeps its distance in days from the start of what's copied.

function addDaysIso(isoDate: string, days: number): string {
  return toIsoDate(addDays(createDateFromIso(isoDate), days));
}

function daysBetweenIso(startIso: string, endIso: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  // Local-time dates; round so a DST change doesn't shift the count by a day.
  return Math.round(
    (createDateFromIso(endIso).getTime() - createDateFromIso(startIso).getTime()) / msPerDay
  );
}

/** A meal to place, relative to the first day being copied. */
type MealToCopy = {
  dayOffset: number;
  recipeId: string | null;
  mealType: MealType;
  servingsOverride: number | null;
};

/** Where copied meals landed: the dates they cover and the new meals. */
export type CopiedMeals = {
  startIso: string;
  endIso: string;
  items: PlannedMeal[];
};

/** Remove the meals the planner shows between two dates (used by "Replace existing"). */
export async function clearMealsBetween(startIso: string, endIso: string): Promise<void> {
  const { error } = await supabase
    .from("planned_meals")
    .delete()
    .gte("planned_for", startIso)
    .lte("planned_for", endIso)
    .in("meal_type", MEAL_TYPES);

  if (error) throw new Error(error.message);
}

/** Place `meals` starting on `targetStartIso`, covering `lengthDays` days.
 *  "replace" first clears the meals already planned on those days. */
async function placeMeals(
  meals: MealToCopy[],
  targetStartIso: string,
  lengthDays: number,
  mode: "add" | "replace"
): Promise<CopiedMeals> {
  const startIso = targetStartIso;
  const endIso = addDaysIso(targetStartIso, lengthDays - 1);

  if (mode === "replace") await clearMealsBetween(startIso, endIso);
  if (meals.length === 0) return { startIso, endIso, items: [] };

  const inserts = meals.map((meal) => ({
    recipe_id: meal.recipeId,
    planned_for: addDaysIso(targetStartIso, meal.dayOffset),
    meal_type: meal.mealType,
    servings_override: meal.servingsOverride,
  }));

  const { data, error } = await supabase
    .from("planned_meals")
    .insert(inserts)
    .select(PLANNED_MEAL_COLUMNS)
    .returns<PlannedMealRow[]>();

  if (error) throw new Error(error.message);
  return { startIso, endIso, items: (data ?? []).map(mapPlannedMealRow) };
}

/** Copy the meals planned between two dates so they start on `targetStartIso`. */
export async function copyMealsBetween(
  sourceStartIso: string,
  sourceEndIso: string,
  targetStartIso: string,
  mode: "add" | "replace"
): Promise<CopiedMeals> {
  // Read before placing, so "replace" can't clear meals that are being copied.
  const meals = await listPlannedMealsBetween(sourceStartIso, sourceEndIso);
  return placeMeals(
    meals.map((meal) => ({
      dayOffset: daysBetweenIso(sourceStartIso, meal.plannedFor),
      recipeId: meal.recipeId,
      mealType: meal.mealType,
      servingsOverride: meal.servingsOverride,
    })),
    targetStartIso,
    daysBetweenIso(sourceStartIso, sourceEndIso) + 1,
    mode
  );
}

// ── Saved meal plans ───────────────────────────────────────────────────────
// A saved plan is a frozen copy of the meals between two dates, stored as day
// offsets from its first day. Changing the calendar later doesn't change it.

const SAVED_PLAN_COLUMNS = "id,name,source_start_date,source_end_date";

type SavedPlanRow = Pick<
  Tables<"saved_plans">,
  "id" | "name" | "source_start_date" | "source_end_date"
>;

type SavedPlanMealRow = Pick<
  Tables<"saved_plan_meals">,
  "id" | "day_offset" | "recipe_id" | "servings_override"
> & {
  meal_type: MealType;
  recipes: RecipeRelation;
};

function mapSavedPlanRow(row: SavedPlanRow): SavedMealPlan {
  return {
    id: row.id,
    savedName: row.name,
    startDate: row.source_start_date,
    endDate: row.source_end_date,
  };
}

/** Names are unique per user; say so plainly instead of showing the database error. */
function savedPlanError(error: { code?: string; message: string }, name: string): Error {
  return error.code === "23505"
    ? new Error(`You already have a saved plan called "${name}".`)
    : new Error(error.message);
}

/** Save the meals planned between two dates as a new plan named `name`. */
export async function saveMealsAsPlan(
  name: string,
  startIso: string,
  endIso: string
): Promise<SavedMealPlan> {
  const trimmed = name.trim();
  const meals = await listPlannedMealsBetween(startIso, endIso);

  const { data: plan, error: planError } = await supabase
    .from("saved_plans")
    .insert({ name: trimmed, source_start_date: startIso, source_end_date: endIso })
    .select(SAVED_PLAN_COLUMNS)
    .single<SavedPlanRow>();

  if (planError) throw savedPlanError(planError, trimmed);
  if (meals.length === 0) return mapSavedPlanRow(plan);

  const { error: mealsError } = await supabase
    .from("saved_plan_meals")
    .insert(
      meals.map((meal) => ({
        saved_plan_id: plan.id,
        day_offset: daysBetweenIso(startIso, meal.plannedFor),
        meal_type: meal.mealType,
        recipe_id: meal.recipeId,
        servings_override: meal.servingsOverride,
      }))
    )
    .returns<null>();

  if (mealsError) {
    // Don't leave a saved plan with missing meals behind.
    await supabase.from("saved_plans").delete().eq("id", plan.id).returns<null>();
    throw new Error(mealsError.message);
  }

  return mapSavedPlanRow(plan);
}

/** Change the name of a saved plan. */
export async function renameSavedMealPlan(planId: string, newName: string): Promise<SavedMealPlan> {
  const trimmed = newName.trim();
  const { data, error } = await supabase
    .from("saved_plans")
    .update({ name: trimmed })
    .eq("id", planId)
    .select(SAVED_PLAN_COLUMNS)
    .single<SavedPlanRow>();

  if (error) throw savedPlanError(error, trimmed);
  return mapSavedPlanRow(data);
}

/** Permanently delete a saved plan (its saved meals cascade). Meals on the
 *  calendar are separate and stay. */
export async function deleteSavedMealPlan(planId: string): Promise<void> {
  const { error } = await supabase
    .from("saved_plans")
    .delete()
    .eq("id", planId)
    .returns<null>();

  if (error) throw new Error(error.message);
}

/** List all saved plans for the current user, newest first. */
export async function listSavedMealPlans(): Promise<SavedMealPlan[]> {
  const { data, error } = await supabase
    .from("saved_plans")
    .select(SAVED_PLAN_COLUMNS)
    .order("created_at", { ascending: false })
    .returns<SavedPlanRow[]>();

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapSavedPlanRow);
}

/** Search saved plans whose name contains the given query (case-insensitive). */
export async function searchSavedMealPlans(query: string): Promise<SavedMealPlan[]> {
  const trimmed = query.trim();
  let q = supabase
    .from("saved_plans")
    .select(SAVED_PLAN_COLUMNS)
    .order("created_at", { ascending: false });

  if (trimmed) {
    q = q.ilike("name", `%${trimmed}%`);
  }

  const { data, error } = await q.returns<SavedPlanRow[]>();
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapSavedPlanRow);
}

/** A saved plan's dates and meals, each dated as it was when saved
 *  (its first day + the meal's day offset). */
async function getSavedPlanWithMeals(
  savedPlanId: string
): Promise<{ plan: SavedMealPlan; meals: PlannedMeal[] }> {
  const { data: planRow, error: planError } = await supabase
    .from("saved_plans")
    .select(SAVED_PLAN_COLUMNS)
    .eq("id", savedPlanId)
    .single<SavedPlanRow>();

  if (planError || !planRow) {
    throw new Error(planError?.message ?? "Saved plan not found.");
  }
  const plan = mapSavedPlanRow(planRow);

  const { data, error } = await supabase
    .from("saved_plan_meals")
    .select("id,day_offset,meal_type,recipe_id,servings_override,recipes(title,servings)")
    .eq("saved_plan_id", savedPlanId)
    .order("day_offset", { ascending: true })
    .returns<SavedPlanMealRow[]>();

  if (error) throw new Error(error.message);

  const meals = (data ?? []).map((row) =>
    mapPlannedMealRow({
      id: row.id,
      recipe_id: row.recipe_id,
      planned_for: addDaysIso(plan.startDate, row.day_offset),
      meal_type: row.meal_type,
      servings_override: row.servings_override,
      recipes: row.recipes,
    })
  );
  return { plan, meals };
}

/** A saved plan's meals, dated from the plan's first day. Used for previews
 *  and grocery lists built from a saved plan. */
export async function listSavedPlanMeals(savedPlanId: string): Promise<PlannedMeal[]> {
  return (await getSavedPlanWithMeals(savedPlanId)).meals;
}

/** Preview a saved plan: recipe names grouped by day, in plan-day order. */
export async function previewSavedMealPlan(savedPlanId: string): Promise<MealPlanDayPreview[]> {
  return groupMealsByDay(await listSavedPlanMeals(savedPlanId));
}

/** Place a saved plan's meals starting on `targetStartIso`, keeping each
 *  meal's day offset. Plans longer than a week continue into later weeks. */
export async function applySavedPlan(
  savedPlanId: string,
  targetStartIso: string,
  mode: "add" | "replace"
): Promise<CopiedMeals> {
  const { plan, meals } = await getSavedPlanWithMeals(savedPlanId);
  return placeMeals(
    meals.map((meal) => ({
      dayOffset: daysBetweenIso(plan.startDate, meal.plannedFor),
      recipeId: meal.recipeId,
      mealType: meal.mealType,
      servingsOverride: meal.servingsOverride,
    })),
    targetStartIso,
    daysBetweenIso(plan.startDate, plan.endDate) + 1,
    mode
  );
}
