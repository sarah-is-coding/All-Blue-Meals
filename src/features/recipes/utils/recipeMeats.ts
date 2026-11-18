import type { RecipeIngredient } from "../types";

/**
 * The meat and seafood a recipe uses ("chicken thighs", "bacon"): its main
 * ingredients in the Meat & Seafood department, once each, in recipe order.
 * Substitutes ("or tofu") are left out, since they're optional.
 */
export function meatsIn(ingredients: ReadonlyArray<RecipeIngredient>): string[] {
  const seen = new Set<string>();
  const meats: string[] = [];
  for (const ingredient of ingredients) {
    const name = ingredient.ingredientName.trim();
    const key = name.toLowerCase();
    if (ingredient.substituteFor || ingredient.category !== "meat_seafood" || !name || seen.has(key)) continue;
    seen.add(key);
    meats.push(name);
  }
  return meats;
}
