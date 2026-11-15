import { supabase } from "../../lib/supabaseClient";
import type { Tables } from "../../lib/db/database.types";
import { getWeekEndIso, getWeekStartIso, toIsoDate } from "../../lib/utils/dates";
import type {
  AddMealPlanItemInput,
  MealPlanDayPreview,
  MealPlanItem,
  MealPlanSpan,
  MoveMealPlanItemInput,
  MealType,
  SavedMealPlan,
  UpdateMealPlanItemServingsInput,
} from "./types";

type MealPlanRow = Pick<Tables<"meal_plans">, "id" | "end_date">;

type RecipeRelationRow = Pick<Tables<"recipes">, "title" | "servings">;

type RecipeRelation = RecipeRelationRow | RecipeRelationRow[] | null;

type MealPlanItemRow = Pick<Tables<"meal_plan_items">, "id" | "recipe_id" | "planned_for" | "servings_override"> & {
  // meal_type is a CHECK-constrained text column; narrow to its allowed values.
  meal_type: MealType | "other" | null;
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

function mapMealPlanItemRow(row: MealPlanItemRow): MealPlanItem {
  if (!MEAL_TYPES.includes(row.meal_type as MealType)) {
    throw new Error("Unsupported meal type on meal plan item.");
  }
  const mealType = row.meal_type as MealType;
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

async function requireUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message);
  }

  if (!user) {
    throw new Error("You must be signed in to manage meal plans.");
  }

  return user.id;
}

async function getMealPlanForWeek(weekStartIso: string): Promise<MealPlanRow | null> {
  const { data, error } = await supabase
    .from("meal_plans")
    .select("id,end_date")
    .eq("start_date", weekStartIso)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<MealPlanRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

async function ensureMealPlanIdForWeek(weekStartIso: string): Promise<string> {
  const existing = await getMealPlanForWeek(weekStartIso);
  if (existing) {
    return existing.id;
  }

  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("meal_plans")
    .insert({
      user_id: userId,
      title: `Week of ${weekStartIso}`,
      start_date: weekStartIso,
      end_date: getWeekEndIso(weekStartIso), // 7-day default; update when UI supports custom lengths
    })
    .select("id,end_date")
    .single<MealPlanRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data.id;
}

// ── Which meals count ────────────────────────────────────────────────────
// One definition of "the meals planned for a span of time", shared by the
// planner, grocery lists, previews, and copying plans, so they always agree.

const MEAL_PLAN_ITEM_COLUMNS =
  "id,recipe_id,planned_for,meal_type,servings_override,recipes(title,servings)";

/** Every meal the user has planned between two dates (inclusive), from any of
 *  their plans, limited to the meal types the app shows. Dates decide what's in
 *  a week, not which plan a meal belongs to, so this keeps working when plans
 *  can be longer than a week. RLS scopes rows to the signed-in user. */
export async function listMealPlanItemsBetween(
  startIso: string,
  endIso: string
): Promise<MealPlanItem[]> {
  const { data, error } = await supabase
    .from("meal_plan_items")
    .select(MEAL_PLAN_ITEM_COLUMNS)
    .gte("planned_for", startIso)
    .lte("planned_for", endIso)
    .in("meal_type", MEAL_TYPES)
    .order("planned_for", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<MealPlanItemRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapMealPlanItemRow);
}

type PlanRangeRow = Pick<Tables<"meal_plans">, "start_date" | "end_date">;

/** A plan's start date and its own meals within its start and end dates. */
async function getPlanWithItems(
  planId: string
): Promise<{ startDate: string; items: MealPlanItem[] }> {
  const { data: plan, error: planError } = await supabase
    .from("meal_plans")
    .select("start_date,end_date")
    .eq("id", planId)
    .single<PlanRangeRow>();

  if (planError || !plan) {
    throw new Error(planError?.message ?? "Meal plan not found.");
  }

  // Legacy rows without end_date are one week long.
  const endIso = plan.end_date ?? getWeekEndIso(plan.start_date);
  const { data, error } = await supabase
    .from("meal_plan_items")
    .select(MEAL_PLAN_ITEM_COLUMNS)
    .eq("meal_plan_id", planId)
    .gte("planned_for", plan.start_date)
    .lte("planned_for", endIso)
    .in("meal_type", MEAL_TYPES)
    .order("planned_for", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<MealPlanItemRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return { startDate: plan.start_date, items: (data ?? []).map(mapMealPlanItemRow) };
}

/** A plan's own meals within its start and end dates. Used for saved-plan
 *  previews, applying a saved plan, and grocery lists built from a plan. */
export async function listMealPlanItemsForPlan(planId: string): Promise<MealPlanItem[]> {
  return (await getPlanWithItems(planId)).items;
}

/** The meals shown on the planner for the week starting `weekStartIso`. */
export async function listMealPlanItemsForWeek(weekStartIso: string): Promise<MealPlanItem[]> {
  return listMealPlanItemsBetween(weekStartIso, getWeekEndIso(weekStartIso));
}

/** Remove the meals the planner shows for a week (used by "Replace existing"). */
export async function clearWeekPlan(weekStartIso: string): Promise<void> {
  const { error } = await supabase
    .from("meal_plan_items")
    .delete()
    .gte("planned_for", weekStartIso)
    .lte("planned_for", getWeekEndIso(weekStartIso))
    .in("meal_type", MEAL_TYPES);

  if (error) throw new Error(error.message);
}

export async function addMealPlanItem(input: AddMealPlanItemInput): Promise<MealPlanItem> {
  const mealPlanId = await ensureMealPlanIdForWeek(input.weekStartIso);
  const { data, error } = await supabase
    .from("meal_plan_items")
    .insert({
      meal_plan_id: mealPlanId,
      recipe_id: input.recipeId,
      planned_for: input.plannedFor,
      meal_type: input.mealType,
      servings_override: input.servingsOverride,
    })
    .select("id,recipe_id,planned_for,meal_type,servings_override,recipes(title,servings)")
    .single<MealPlanItemRow>();

  if (error) {
    throw new Error(error.message);
  }

  return mapMealPlanItemRow(data);
}

export async function deleteMealPlanItem(itemId: string): Promise<void> {
  const { error } = await supabase.from("meal_plan_items").delete().eq("id", itemId);
  if (error) {
    throw new Error(error.message);
  }
}

export async function moveMealPlanItem(input: MoveMealPlanItemInput): Promise<MealPlanItem> {
  const { data, error } = await supabase
    .from("meal_plan_items")
    .update({
      planned_for: input.plannedFor,
      meal_type: input.mealType,
    })
    .eq("id", input.itemId)
    .select("id,recipe_id,planned_for,meal_type,servings_override,recipes(title,servings)")
    .single<MealPlanItemRow>();

  if (error) {
    throw new Error(error.message);
  }

  return mapMealPlanItemRow(data);
}



export async function updateMealPlanItemServings(
  input: UpdateMealPlanItemServingsInput
): Promise<MealPlanItem> {
  const { data, error } = await supabase
    .from("meal_plan_items")
    .update({
      servings_override: input.servingsOverride,
    })
    .eq("id", input.itemId)
    .select("id,recipe_id,planned_for,meal_type,servings_override,recipes(title,servings)")
    .single<MealPlanItemRow>();

  if (error) {
    throw new Error(error.message);
  }

  return mapMealPlanItemRow(data);
}

// ── Copy a whole week's plan to another week ───────────────────────────────
// Shifts each item by the same weekday index so Mon→Mon, Tue→Tue, etc.
// Adds on top of any existing items in the target week (no items are removed).

function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  // Local-time Date constructor so DST doesn't shift the day
  return toIsoDate(new Date(y, m - 1, d + days));
}

function daysBetweenIso(startIso: string, endIso: string): number {
  const [sy, sm, sd] = startIso.split("-").map(Number);
  const [ey, em, ed] = endIso.split("-").map(Number);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round(
    (new Date(ey, em - 1, ed).getTime() - new Date(sy, sm - 1, sd).getTime()) / msPerDay
  );
}

type CopyItemInsert = {
  meal_plan_id: string;
  recipe_id: string | null;
  planned_for: string;
  meal_type: MealType;
  servings_override: number | null;
};


// ── Saved meal plans ───────────────────────────────────────────────────────

type SavedMealPlanRow = Pick<Tables<"meal_plans">, "id" | "start_date" | "end_date"> & {
  // Queried with saved_name IS NOT NULL, so it is always present here.
  saved_name: string;
};

function mapSavedPlanRow(row: SavedMealPlanRow): SavedMealPlan {
  return {
    id: row.id,
    savedName: row.saved_name,
    startDate: row.start_date,
    endDate: row.end_date,
  };
}

/** Name (and bookmark) a specific plan by its id. */
export async function savePlanById(planId: string, savedName: string): Promise<SavedMealPlan> {
  const { data, error } = await supabase
    .from("meal_plans")
    .update({ saved_name: savedName.trim() })
    .eq("id", planId)
    .select("id,saved_name,start_date,end_date")
    .single<SavedMealPlanRow>();

  if (error) throw new Error(error.message);
  return mapSavedPlanRow(data);
}

/** Name (and thereby bookmark) an existing week's meal plan. Creates the plan row first if needed. */
export async function saveWeekPlan(weekStartIso: string, savedName: string): Promise<SavedMealPlan> {
  const planId = await ensureMealPlanIdForWeek(weekStartIso);
  return savePlanById(planId, savedName);
}

/** Return every meal plan's id + date range for calendar display.
 *  endDate is always populated — legacy rows without end_date fall back to startDate + 6. */
export async function listMealPlanSpans(): Promise<MealPlanSpan[]> {
  type SpanRow = { id: string; start_date: string; end_date: string | null };

  const { data, error } = await supabase
    .from("meal_plans")
    .select("id,start_date,end_date")
    .not("start_date", "is", null)
    .order("start_date", { ascending: false })
    .returns<SpanRow[]>();

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    startDate: row.start_date,
    endDate: row.end_date ?? getWeekEndIso(row.start_date),
  }));
}

/** Remove the saved name from a plan (un-bookmark it). The plan and its items are kept. */
export async function unsaveMealPlan(planId: string): Promise<void> {
  const { error } = await supabase
    .from("meal_plans")
    .update({ saved_name: null })
    .eq("id", planId)
    .returns<null>();

  if (error) throw new Error(error.message);
}

/** Change the name of an already-saved plan. */
export async function renameSavedMealPlan(planId: string, newName: string): Promise<SavedMealPlan> {
  const { data, error } = await supabase
    .from("meal_plans")
    .update({ saved_name: newName.trim() })
    .eq("id", planId)
    .select("id,saved_name,start_date,end_date")
    .single<SavedMealPlanRow>();

  if (error) throw new Error(error.message);
  return mapSavedPlanRow(data);
}

/** Permanently delete a saved plan and all of its meal plan items (cascade). */
export async function deleteSavedMealPlan(planId: string): Promise<void> {
  const { error } = await supabase
    .from("meal_plans")
    .delete()
    .eq("id", planId)
    .returns<null>();

  if (error) throw new Error(error.message);
}

/** List all saved (named) plans for the current user, newest first. */
export async function listSavedMealPlans(): Promise<SavedMealPlan[]> {
  const { data, error } = await supabase
    .from("meal_plans")
    .select("id,saved_name,start_date,end_date")
    .not("saved_name", "is", null)
    .order("created_at", { ascending: false })
    .returns<SavedMealPlanRow[]>();

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapSavedPlanRow);
}

/** Search saved plans whose name contains the given query (case-insensitive). */
export async function searchSavedMealPlans(query: string): Promise<SavedMealPlan[]> {
  const trimmed = query.trim();
  let q = supabase
    .from("meal_plans")
    .select("id,saved_name,start_date,end_date")
    .not("saved_name", "is", null)
    .order("created_at", { ascending: false });

  if (trimmed) {
    q = q.ilike("saved_name", `%${trimmed}%`);
  }

  const { data, error } = await q.returns<SavedMealPlanRow[]>();
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapSavedPlanRow);
}

/** Preview a saved plan: returns recipe names grouped by day, in plan-day order. */
export async function previewSavedMealPlan(planId: string): Promise<MealPlanDayPreview[]> {
  const items = await listMealPlanItemsForPlan(planId);

  const byDate = new Map<string, string[]>();
  for (const item of items) {
    const list = byDate.get(item.plannedFor) ?? [];
    list.push(item.recipeTitle);
    byDate.set(item.plannedFor, list);
  }

  return Array.from(byDate.entries()).map(([dateIso, recipes]) => ({ dateIso, recipes }));
}


/**
 * Copy a saved plan's items to a target week (and any subsequent weeks if the plan spans
 * more than 7 days).  Day offsets from the saved plan's start_date are preserved.
 * Returns only the items that land within the target week, so the caller can update
 * the displayed week's state without a full reload.
 */
export async function applySavedMealPlan(
  savedPlanId: string,
  targetWeekStartIso: string
): Promise<MealPlanItem[]> {
  // 1-2. The saved plan's start date (the anchor) and its own meals.
  const { startDate: anchorIso, items: sourceItems } = await getPlanWithItems(savedPlanId);
  if (sourceItems.length === 0) return [];

  // 3. Resolve which meal-plan record to use for each target week (create if needed).
  const targetPlanIdCache = new Map<string, string>();
  const getTargetPlanId = async (weekIso: string): Promise<string> => {
    const cached = targetPlanIdCache.get(weekIso);
    if (cached) return cached;
    const id = await ensureMealPlanIdForWeek(weekIso);
    targetPlanIdCache.set(weekIso, id);
    return id;
  };

  // 4. Build inserts, grouping items by their computed target week.
  const inserts: CopyItemInsert[] = [];
  for (const item of sourceItems) {
    const dayOffset = daysBetweenIso(anchorIso, item.plannedFor);
    const targetDateIso = addDaysIso(targetWeekStartIso, dayOffset);
    const [y, m, d] = targetDateIso.split("-").map(Number);
    const targetWeekIso = getWeekStartIso(new Date(y, m - 1, d));
    const targetPlanId = await getTargetPlanId(targetWeekIso);

    inserts.push({
      meal_plan_id: targetPlanId,
      recipe_id: item.recipeId,
      planned_for: targetDateIso,
      meal_type: item.mealType,
      servings_override: item.servingsOverride,
    });
  }

  // 5. Insert all items in one batch.
  const { data: inserted, error: insertErr } = await supabase
    .from("meal_plan_items")
    .insert(inserts)
    .select(MEAL_PLAN_ITEM_COLUMNS)
    .returns<MealPlanItemRow[]>();

  if (insertErr) throw new Error(insertErr.message);

  // 6. Return only items that land in the requested target week (for immediate UI update).
  const targetEndIso = getWeekEndIso(targetWeekStartIso);
  return (inserted ?? [])
    .map(mapMealPlanItemRow)
    .filter(
      (item) => item.plannedFor >= targetWeekStartIso && item.plannedFor <= targetEndIso
    );
}
