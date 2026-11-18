// Turning a recipe's ingredient list into saved rows: resolve catalog ids,
// clean text and units, order substitutes after their main row, and save the
// whole list in one transaction. Used by recipes.ts (create and update).

import { supabase } from "../../../lib/supabaseClient";
import { parseQuantityNumber } from "../../../lib/utils/quantities";
import { cleanMissingText, joinNotes } from "../../../lib/utils/text";
import { applySizeQuantity, normalizeUnit } from "../../../lib/utils/units";
import { resolveIngredients } from "../../ingredients/api";
import { ingredientKey } from "../../ingredients/utils/ingredientKey";
import type { RecipeUpsertInput } from "../types";
import { groupSubstitutes } from "../utils/ingredientGroups";

/** Empty, whitespace-only and "no value" words ("null", "n/a") become null. */
export const cleanText = (value: string | null | undefined): string | null =>
  cleanMissingText(value) || null;

/**
 * The rows save_recipe_ingredients stores, in display order: each main
 * ingredient followed by its substitutes, which carry `substitute_of` (the
 * index of their main row in this list). Units get one spelling each
 * ("Tablespoons" → "tbsp"); text that was in the unit field but isn't a unit
 * ("large", "(15 oz)") moves to the notes. Blank rows are dropped; a
 * substitute whose main row was blank becomes a main ingredient.
 */
const getIngredientRows = async (input: RecipeUpsertInput) => {
  // Ingredients typed or imported without a catalog id are found or created
  // in one batch, matched by key (see ingredients/api.ts resolveIngredients).
  const unresolved = input.ingredients.filter(
    (ingredient) => !ingredient.ingredientId && ingredient.ingredientName.trim()
  );
  const resolved = await resolveIngredients(
    unresolved.map((ingredient) => ({
      name: ingredient.ingredientName.trim(),
      category: ingredient.category ?? "other",
      canonicalName: ingredient.canonicalName ?? null,
    }))
  );

  const saved = input.ingredients
    .map((ingredient) => {
      const ingredientName = ingredient.ingredientName.trim();
      const ingredientId =
        ingredient.ingredientId ||
        (ingredientName ? resolved.get(ingredientKey(ingredientName))?.id ?? "" : "");
      // "15" + "ounce can" is one 15 oz can: the size moves to the notes.
      const sized = applySizeQuantity(cleanText(ingredient.quantity) ?? "", normalizeUnit(ingredient.unit));
      const quantityText = cleanText(sized.quantity);
      return {
        id: ingredient.clientId,
        substituteFor: ingredient.substituteFor,
        hasName: ingredientName.length > 0,
        // No ingredient_name: the save function takes the catalog's name
        // (step 8 of docs/ingredient-normalization.md).
        row: {
          ingredient_id: ingredientId,
          quantity: quantityText,
          quantity_numeric: quantityText ? parseQuantityNumber(quantityText) : null,
          unit: sized.unit || null,
          notes: joinNotes([...sized.notes, ingredient.notes]) || null,
        },
      };
    })
    .filter(({ hasName, row }) => hasName && row.ingredient_id);

  // Main rows first, each followed by its substitutes pointing at its index.
  const rows: Array<(typeof saved)[number]["row"] & { substitute_of: number | null }> = [];
  for (const group of groupSubstitutes(saved)) {
    const mainIndex = rows.length;
    rows.push({ ...group.main.row, substitute_of: null });
    for (const substitute of group.substitutes) {
      rows.push({ ...substitute.row, substitute_of: mainIndex });
    }
  }
  return rows;
};

/**
 * Replace a recipe's ingredients in one transaction (save_recipe_ingredients
 * migration): either the new list is saved or the old one stays.
 */
export const saveIngredients = async (recipeId: string, input: RecipeUpsertInput) => {
  const rows = await getIngredientRows(input);
  const { error } = await supabase.rpc("save_recipe_ingredients", {
    p_recipe_id: recipeId,
    p_rows: rows,
  });
  if (error) {
    throw new Error(error.message);
  }
};
