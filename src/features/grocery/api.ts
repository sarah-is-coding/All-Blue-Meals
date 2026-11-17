import { supabase } from "../../lib/supabaseClient";
import type { Tables } from "../../lib/db/database.types";
import type { IngredientCategory } from "../ingredients/types";
import { scaleQuantityText } from "../../lib/utils/quantities";
import { listPlannedMealsBetween, listSavedPlanMeals } from "../meal-plans/api";
import type { PlannedMeal } from "../meal-plans/types";
import { mergeIngredients } from "./utils/groceryGeneration";
import type {
  GroceryItem,
  GroceryItemDraft,
  GroceryList,
  GroceryListOrigin,
  GroceryListSummary,
} from "./types";

// ── Internal row types ──────────────────────────────────────────────────────

type RecipeIngRow = Pick<Tables<"recipe_ingredients">, "recipe_id" | "ingredient_name" | "quantity" | "unit"> & {
  ingredients: Pick<Tables<"ingredients">, "category"> | null;
};

type GroceryListRow = Pick<
  Tables<"grocery_lists">,
  "id" | "title" | "saved_plan_id" | "start_date" | "end_date" | "created_at"
>;

const LIST_COLUMNS = "id, title, saved_plan_id, start_date, end_date, created_at";

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
    savedPlanId: row.saved_plan_id,
    startDate: row.start_date,
    endDate: row.end_date,
    createdAt: row.created_at,
    items,
  };
}

function mapSummaryRow(row: GroceryListRow): GroceryListSummary {
  return {
    id: row.id,
    title: row.title,
    savedPlanId: row.saved_plan_id,
    startDate: row.start_date,
    endDate: row.end_date,
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

// ── Grocery generation ──────────────────────────────────────────────────────

/**
 * Turn planned meals into a grocery list: fetch every planned recipe's
 * ingredients, scale each to that meal's servings, then merge duplicates.
 * Which meals count is decided by meal-plans (listPlannedMealsBetween /
 * listSavedPlanMeals), the same definition the planner uses.
 */
async function buildGroceryItemsFromMeals(meals: PlannedMeal[]): Promise<GroceryItemDraft[]> {
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

/** Grocery list for a saved plan: its frozen copy of the meals it was saved with. */
export async function buildGroceryItemsForSavedPlan(
  savedPlanId: string
): Promise<GroceryItemDraft[]> {
  return buildGroceryItemsFromMeals(await listSavedPlanMeals(savedPlanId));
}

/** Grocery list for a date range: every meal planned between the two dates
 *  (inclusive), exactly what the planner shows for those days. */
export async function buildGroceryItemsForRange(
  startIso: string,
  endIso: string
): Promise<GroceryItemDraft[]> {
  return buildGroceryItemsFromMeals(await listPlannedMealsBetween(startIso, endIso));
}

// ── Persistence ─────────────────────────────────────────────────────────────

export async function saveGroceryList(
  title: string,
  origin: GroceryListOrigin,
  items: GroceryItemDraft[]
): Promise<GroceryList> {
  const userId = await requireUserId();

  const { data: listRow, error: listErr } = await supabase
    .from("grocery_lists")
    .insert({
      user_id: userId,
      title: title.trim(),
      saved_plan_id: origin.kind === "saved_plan" ? origin.savedPlanId : null,
      start_date: origin.kind === "range" ? origin.startDate : null,
      end_date: origin.kind === "range" ? origin.endDate : null,
    })
    .select(LIST_COLUMNS)
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
    .select(LIST_COLUMNS)
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
    .select(LIST_COLUMNS)
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
    .select(LIST_COLUMNS)
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
