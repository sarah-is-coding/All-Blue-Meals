import { INGREDIENT_CATEGORIES, type IngredientCategory } from "../../ingredients/types";
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

export const isIngredientCategory = (
  value: string | null | undefined
): value is IngredientCategory =>
  Boolean(value && INGREDIENT_CATEGORIES.includes(value as IngredientCategory));

export const mapImportedRecipeToInput = (
  recipe: ImportedRecipe
): RecipeUpsertInput => ({
  title: normalizeText(recipe.title),
  description: normalizeText(recipe.description),
  sourceUrl: recipe.sourceUrl,
  prepMinutes: recipe.prepMinutes,
  cookMinutes: recipe.cookMinutes,
  servings: recipe.servings,
  tags: recipe.tags,
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
  tags: recipe.tags.join(", "),
  instructions: formatImportedInstructions(recipe.instructions),
  ingredients: (() => {
    const rows = importedIngredientRows(recipe.ingredients, () => createEmptyIngredient().id);
    return rows.length > 0
      ? rows.map((row) => ({ ...row, ingredientId: "" }))
      : [createEmptyIngredient()];
  })(),
});
