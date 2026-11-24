import type { ImportedRecipe, ImportedRecipeIngredient, RecipeImportResult } from "../types";

// The import edge function's answer is checked before the app uses it. The
// function already validates and trims Gemini's output
// (supabase/functions/import-recipes/validate.ts); this guards the shape the
// review screen relies on, so a bad response shows a warning instead of
// breaking the page.

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const optionalNumber = (value: unknown): number | null => (typeof value === "number" ? value : null);

const isIngredient = (value: unknown): value is ImportedRecipeIngredient =>
  isRecord(value) &&
  typeof value.ingredientName === "string" &&
  typeof value.quantity === "string" &&
  typeof value.unit === "string" &&
  typeof value.notes === "string";

const readRecipe = (value: unknown): ImportedRecipe | null => {
  if (!isRecord(value) || typeof value.title !== "string" || !value.title.trim()) return null;
  if (!Array.isArray(value.ingredients)) return null;
  return {
    title: value.title,
    description: typeof value.description === "string" ? value.description : "",
    sourceUrl: typeof value.sourceUrl === "string" ? value.sourceUrl : null,
    prepMinutes: optionalNumber(value.prepMinutes),
    cookMinutes: optionalNumber(value.cookMinutes),
    servings: optionalNumber(value.servings),
    tags: strings(value.tags),
    instructions: typeof value.instructions === "string" ? value.instructions : "",
    ingredients: value.ingredients.filter(isIngredient),
    confidence: value.confidence === "high" || value.confidence === "medium" ? value.confidence : "low",
    warnings: strings(value.warnings),
  };
};

/** The drafts and warnings from the function's JSON, dropping anything that
 *  isn't a usable recipe (with a warning saying so). */
export function readImportResponse(data: unknown): RecipeImportResult {
  const rawRecipes = isRecord(data) && Array.isArray(data.recipes) ? data.recipes : [];
  const recipes = rawRecipes.flatMap((recipe) => readRecipe(recipe) ?? []);
  const warnings = isRecord(data) ? strings(data.warnings) : [];
  const dropped = rawRecipes.length - recipes.length;
  if (dropped > 0) {
    warnings.push(
      dropped === 1
        ? "One recipe couldn't be read and was left out."
        : `${dropped} recipes couldn't be read and were left out.`
    );
  }
  return { recipes, warnings };
}
