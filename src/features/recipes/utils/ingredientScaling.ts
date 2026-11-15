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
