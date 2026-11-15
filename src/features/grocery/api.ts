import { supabase } from "../../lib/supabaseClient";
import type { Tables } from "../../lib/db/database.types";
import type { IngredientCategory } from "../ingredients/types";
import { getWeekEndIso } from "../../lib/utils/dates";
import { scaleQuantityText } from "../../lib/utils/quantities";
import { listMealPlanItemsBetween, listMealPlanItemsForPlan } from "../meal-plans/api";
import type { MealPlanItem } from "../meal-plans/types";
import { mergeIngredients } from "./utils/groceryGeneration";
import type {
  GroceryItem,
  GroceryItemDraft,
  GroceryList,
  GroceryListSummary,
} from "./types";

// ── Internal row types ──────────────────────────────────────────────────────

type RecipeIngRow = Pick<Tables<"recipe_ingredients">, "recipe_id" | "ingredient_name" | "quantity" | "unit"> & {
  ingredients: Pick<Tables<"ingredients">, "category"> | null;
};

type GroceryListRow = Pick<Tables<"grocery_lists">, "id" | "title" | "meal_plan_id" | "created_at">;

type GroceryItemRow = Pick<Tables<"grocery_items">, "id" | "ingredient_name" | "quantity" | "unit" | "is_checked" | "category">;

// ── Helpers ─────────────────────────────────────────────────────────────────

function mapItemRow(row: GroceryItemRow): GroceryItem {
  return {
    id: row.id,
    ingredientName: row.ingredient_name,
    quantity: row.quantity ?? "",
    unit: row.unit ?? "",
    isChecked: row.is_checked,
    category: (row.category ?? null) as IngredientCategory | null,
  };
}

function mapListRow(row: GroceryListRow, items: GroceryItem[]): GroceryList {
  return {
    id: row.id,
    title: row.title,
    mealPlanId: row.meal_plan_id,
    createdAt: row.created_at,
    items,
  };
}

function mapSummaryRow(row: GroceryListRow): GroceryListSummary {
  return {
    id: row.id,
    title: row.title,
    mealPlanId: row.meal_plan_id,
    createdAt: row.created_at,
  };
}

async function requireUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);
  if (!user) throw new Error("You must be signed in to manage grocery lists.");
  return user.id;
}

/** Returns the meal_plan id whose start_date matches the given week ISO, or null. */
async function getPlanIdForWeek(weekStartIso: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("meal_plans")
    .select("id")
    .eq("start_date", weekStartIso)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

// ── Grocery generation ──────────────────────────────────────────────────────

/**
 * Turn planned meals into a grocery list: fetch every planned recipe's
 * ingredients, scale each to that meal's servings, then merge duplicates.
 * Which meals count is decided by meal-plans (listMealPlanItemsBetween /
 * listMealPlanItemsForPlan), the same definition the planner uses.
 */
async function buildGroceryItemsFromMeals(meals: MealPlanItem[]): Promise<GroceryItemDraft[]> {
  const recipeIds = Array.from(
    new Set(meals.map((meal) => meal.recipeId).filter((id): id is string => id !== null))
  );
  if (recipeIds.length === 0) return [];

  // Batch-fetch all recipe ingredients (including category via ingredient FK)
  const { data: ingRows, error: ingErr } = await supabase
    .from("recipe_ingredients")
    .select("recipe_id, ingredient_name, quantity, unit, ingredients(category)")
    .in("recipe_id", recipeIds)
    .returns<RecipeIngRow[]>();

  if (ingErr) throw new Error(ingErr.message);

  const ingByRecipe = new Map<string, RecipeIngRow[]>();
  for (const row of ingRows ?? []) {
    const list = ingByRecipe.get(row.recipe_id) ?? [];
    list.push(row);
    ingByRecipe.set(row.recipe_id, list);
  }

  // Scale each planned meal's ingredients to the servings planned for it
  const scaled: GroceryItemDraft[] = [];
  for (const meal of meals) {
    if (!meal.recipeId) continue;
    for (const ing of ingByRecipe.get(meal.recipeId) ?? []) {
      scaled.push({
        ingredientName: ing.ingredient_name,
        quantity: scaleQuantityText(ing.quantity ?? "", meal.recipeServings, meal.effectiveServings),
        unit: ing.unit ?? "",
        category: (ing.ingredients?.category ?? null) as IngredientCategory | null,
      });
    }
  }

  return mergeIngredients(scaled);
}

/** Grocery list for a plan: its own meals within its start and end dates. */
export async function buildGroceryItemsForPlan(planId: string): Promise<GroceryItemDraft[]> {
  return buildGroceryItemsFromMeals(await listMealPlanItemsForPlan(planId));
}

/**
 * Grocery list for a week: every meal planned in that week (exactly what the
 * planner shows), plus the week's plan id (if there is one) so the saved list
 * can link back to it.
 */
export async function buildGroceryItemsForWeek(weekStartIso: string): Promise<{
  items: GroceryItemDraft[];
  planId: string | null;
}> {
  const [meals, planId] = await Promise.all([
    listMealPlanItemsBetween(weekStartIso, getWeekEndIso(weekStartIso)),
    getPlanIdForWeek(weekStartIso),
  ]);
  return { items: await buildGroceryItemsFromMeals(meals), planId };
}

// ── Persistence ─────────────────────────────────────────────────────────────

export async function saveGroceryList(
  title: string,
  mealPlanId: string | null,
  items: GroceryItemDraft[]
): Promise<GroceryList> {
  const userId = await requireUserId();

  const { data: listRow, error: listErr } = await supabase
    .from("grocery_lists")
    .insert({
      user_id: userId,
      title: title.trim(),
      meal_plan_id: mealPlanId,
    })
    .select("id, title, meal_plan_id, created_at")
    .single<GroceryListRow>();

  if (listErr) throw new Error(listErr.message);

  if (items.length === 0) {
    return mapListRow(listRow, []);
  }

  const { data: itemRows, error: itemErr } = await supabase
    .from("grocery_items")
    .insert(
      items.map((item) => ({
        list_id: listRow.id,
        ingredient_name: item.ingredientName,
        quantity: item.quantity || null,
        unit: item.unit || null,
        is_checked: false,
        category: item.category || null,
      }))
    )
    .select("id, ingredient_name, quantity, unit, is_checked, category")
    .returns<GroceryItemRow[]>();

  if (itemErr) throw new Error(itemErr.message);

  return mapListRow(listRow, (itemRows ?? []).map(mapItemRow));
}

export async function getGroceryList(listId: string): Promise<GroceryList | null> {
  const { data: listRow, error: listErr } = await supabase
    .from("grocery_lists")
    .select("id, title, meal_plan_id, created_at")
    .eq("id", listId)
    .maybeSingle<GroceryListRow>();

  if (listErr) throw new Error(listErr.message);
  if (!listRow) return null;

  const { data: itemRows, error: itemErr } = await supabase
    .from("grocery_items")
    .select("id, ingredient_name, quantity, unit, is_checked, category")
    .eq("list_id", listId)
    .order("created_at", { ascending: true })
    .returns<GroceryItemRow[]>();

  if (itemErr) throw new Error(itemErr.message);

  return mapListRow(listRow, (itemRows ?? []).map(mapItemRow));
}

export async function listSavedGroceryLists(): Promise<GroceryListSummary[]> {
  const { data, error } = await supabase
    .from("grocery_lists")
    .select("id, title, meal_plan_id, created_at")
    .order("created_at", { ascending: false })
    .returns<GroceryListRow[]>();

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapSummaryRow);
}

export async function deleteGroceryList(listId: string): Promise<void> {
  const { error } = await supabase
    .from("grocery_lists")
    .delete()
    .eq("id", listId)
    .returns<null>();

  if (error) throw new Error(error.message);
}

export async function renameGroceryList(
  listId: string,
  newName: string
): Promise<GroceryListSummary> {
  const { data, error } = await supabase
    .from("grocery_lists")
    .update({ title: newName.trim() })
    .eq("id", listId)
    .select("id, title, meal_plan_id, created_at")
    .single<GroceryListRow>();

  if (error) throw new Error(error.message);
  return mapSummaryRow(data);
}

export async function toggleGroceryItem(
  itemId: string,
  isChecked: boolean
): Promise<void> {
  const { error } = await supabase
    .from("grocery_items")
    .update({ is_checked: isChecked })
    .eq("id", itemId)
    .returns<null>();

  if (error) throw new Error(error.message);
}

export async function uncheckAllGroceryItems(listId: string): Promise<void> {
  const { error } = await supabase
    .from("grocery_items")
    .update({ is_checked: false })
    .eq("list_id", listId)
    .returns<null>();

  if (error) throw new Error(error.message);
}
