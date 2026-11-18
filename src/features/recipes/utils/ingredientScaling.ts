import { scaleQuantityText } from "../../../lib/utils/quantities";
import type { RecipeFormIngredient } from "./recipeForm";

export const scaleRecipeFormIngredientQuantities = (
  ingredients: RecipeFormIngredient[],
  fromServings: number | null,
  toServings: number | null
): RecipeFormIngredient[] =>
  ingredients.map((ingredient) => ({
    ...ingredient,
    quantity: scaleQuantityText(ingredient.quantity, fromServings, toServings),
  }));

/** A positive whole number of servings, or null for empty / invalid input. */
export const parseServingsValue = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const normalized = String(value).trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.round(parsed);
};

export type ScaleToServingsResult =
  | { kind: "error"; message: string }
  | { kind: "unchanged"; message: string }
  | { kind: "scaled"; ingredients: RecipeFormIngredient[]; servings: number; message: string };

/**
 * What "Scale ingredients" should do in edit mode: rescale every quantity
 * from the servings they're written for to the servings entered in the form.
 */
export const scaleIngredientsToServings = (
  ingredients: RecipeFormIngredient[],
  baseServings: number | null,
  servingsText: string
): ScaleToServingsResult => {
  const nextServings = parseServingsValue(servingsText);
  if (!nextServings) {
    return { kind: "error", message: "Enter a valid servings value before scaling ingredients." };
  }
  if (!baseServings) {
    return { kind: "error", message: "Set base servings first before scaling ingredient quantities." };
  }
  if (nextServings === baseServings) {
    return { kind: "unchanged", message: "Ingredients already match the current servings value." };
  }
  return {
    kind: "scaled",
    ingredients: scaleRecipeFormIngredientQuantities(ingredients, baseServings, nextServings),
    servings: nextServings,
    message: `Scaled ingredient quantities from ${baseServings} to ${nextServings} servings.`,
  };
};
