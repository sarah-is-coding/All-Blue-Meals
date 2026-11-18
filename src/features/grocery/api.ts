// Building a grocery list from planned meals. Lists aren't saved: the
// grocery page builds one when asked and ticks live only on the page.

import { supabase } from "../../lib/supabaseClient";
import type { Tables } from "../../lib/db/database.types";
import { toCategoryCode } from "../ingredients/categories/codes";
import { scaleQuantityText } from "../../lib/utils/quantities";
import { listPlannedMealsBetween, listSavedPlanMeals } from "../meal-plans/api";
import type { PlannedMeal } from "../meal-plans/types";
import { mergeIngredients, type ScaledIngredient } from "./utils/groceryGeneration";
import type { GroceryItemDraft } from "./types";

// ── Internal row types ──────────────────────────────────────────────────────

type RecipeIngRow = Pick<
  Tables<"recipe_ingredients">,
  "id" | "recipe_id" | "ingredient_id" | "quantity" | "unit" | "notes" | "substitute_for"
> & {
  ingredients: Pick<Tables<"ingredients">, "name" | "category"> | null;
};

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

  // Batch-fetch all recipe ingredients, with the catalog name and category.
  // Substitute rows ("or avocado oil") come too: they're attached to their
  // main row and shown as options, not added as items to buy.
  const { data: ingRows, error: ingErr } = await supabase
    .from("recipe_ingredients")
    .select(
      "id, recipe_id, ingredient_id, quantity, unit, notes, substitute_for, ingredients(name, category)"
    )
    .in("recipe_id", recipeIds)
    .order("position", { ascending: true })
    .returns<RecipeIngRow[]>();

  if (ingErr) throw new Error(ingErr.message);

  const ingByRecipe = new Map<string, RecipeIngRow[]>();
  const substitutesByMain = new Map<string, RecipeIngRow[]>();
  for (const row of ingRows ?? []) {
    if (row.substitute_for) {
      substitutesByMain.set(row.substitute_for, [...(substitutesByMain.get(row.substitute_for) ?? []), row]);
      continue;
    }
    ingByRecipe.set(row.recipe_id, [...(ingByRecipe.get(row.recipe_id) ?? []), row]);
  }

  // Scale each planned meal's ingredients (and their substitutes) to the
  // servings planned for it.
  const scaled: ScaledIngredient[] = [];
  for (const meal of meals) {
    if (!meal.recipeId) continue;
    const scale = (row: RecipeIngRow): ScaledIngredient => ({
      ingredientId: row.ingredient_id,
      ingredientName: row.ingredients?.name ?? "",
      quantity: scaleQuantityText(row.quantity ?? "", meal.recipeServings, meal.effectiveServings),
      unit: row.unit ?? "",
      notes: row.notes ?? "",
      category: toCategoryCode(row.ingredients?.category),
    });
    for (const row of ingByRecipe.get(meal.recipeId) ?? []) {
      scaled.push({ ...scale(row), substitutes: (substitutesByMain.get(row.id) ?? []).map(scale) });
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
