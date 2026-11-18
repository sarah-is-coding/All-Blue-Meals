import type { ImportedRecipe, RecipeUpsertInput } from "../types";
import { importedIngredientRows } from "./importedIngredients";
import {
  createEmptyIngredient,
  type RecipeFormValues,
} from "./recipeForm";

const normalizeNumberText = (value: number | null): string =>
  value && value > 0 ? String(value) : "";

const normalizeText = (value: string | null | undefined): string =>
  (value ?? "").trim();

export const formatImportedInstructions = (value: string): string => {
  const normalized = normalizeText(value).replace(/\s+/g, " ");
  if (!normalized) {
    return "";
  }

  return normalized
    .replace(/\s+(\d+\.\s+)/g, "\n$1")
    .replace(/^\n+/, "")
    .trim();
};

/**
 * Imported tags, tidied without limiting which tags the AI may use: spaces
 * collapsed, trimmed, lowercase ("Italian" = "italian"), no repeats or blanks.
 */
export const normalizeImportedTags = (tags: ReadonlyArray<string> | null | undefined): string[] => {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const tag of tags ?? []) {
    const cleaned = tag.replace(/\s+/g, " ").trim().toLowerCase();
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    kept.push(cleaned);
  }
  return kept;
};

export const mapImportedRecipeToInput = (
  recipe: ImportedRecipe
): RecipeUpsertInput => ({
  title: normalizeText(recipe.title),
  description: normalizeText(recipe.description),
  sourceUrl: recipe.sourceUrl,
  prepMinutes: recipe.prepMinutes,
  cookMinutes: recipe.cookMinutes,
  servings: recipe.servings,
  tags: normalizeImportedTags(recipe.tags),
  instructions: formatImportedInstructions(recipe.instructions),
  ingredients: importedIngredientRows(recipe.ingredients, sequentialIds("imported")).map(
    ({ id, ...row }) => ({ clientId: id, ingredientId: "", ...row })
  ),
});

const sequentialIds = (prefix: string) => {
  let next = 0;
  return () => `${prefix}-${next++}`;
};

export const mapImportedRecipeToFormValues = (
  recipe: ImportedRecipe
): RecipeFormValues => ({
  title: normalizeText(recipe.title),
  description: normalizeText(recipe.description),
  sourceUrl: normalizeText(recipe.sourceUrl),
  prepMinutes: normalizeNumberText(recipe.prepMinutes),
  cookMinutes: normalizeNumberText(recipe.cookMinutes),
  servings: normalizeNumberText(recipe.servings),
  tags: normalizeImportedTags(recipe.tags).join(", "),
  instructions: formatImportedInstructions(recipe.instructions),
  ingredients: (() => {
    const rows = importedIngredientRows(recipe.ingredients, () => createEmptyIngredient().id);
    return rows.length > 0
      ? rows.map((row) => ({ ...row, ingredientId: "" }))
      : [createEmptyIngredient()];
  })(),
});
