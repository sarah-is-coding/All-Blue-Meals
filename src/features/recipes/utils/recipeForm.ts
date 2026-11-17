import type { IngredientCategory } from "../../ingredients/types";
import type { RecipeDetail, RecipeUpsertInput } from "../types";
import { insertSubstitute, removeRowWithSubstitutes } from "./ingredientGroups";

export type RecipeFormIngredient = {
  id: string;
  ingredientId: string;
  ingredientName: string;
  quantity: string;
  unit: string;
  notes: string;
  category: IngredientCategory | null;
  /** Row id of the main ingredient this is a substitute for; null for a main row. */
  substituteFor: string | null;
};

export type RecipeFormValues = {
  title: string;
  description: string;
  sourceUrl: string;
  prepMinutes: string;
  cookMinutes: string;
  servings: string;
  tags: string;
  instructions: string;
  ingredients: RecipeFormIngredient[];
};

const parseOptionalNumber = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsedValue = Number(trimmed);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return Math.round(parsedValue);
};

const parseTags = (value: string): string[] => {
  const tags = value
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

  return Array.from(new Set(tags));
};

const createClientId = (): string => {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  const nowPart = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `tmp-${nowPart}-${randomPart}`;
};

export const createEmptyIngredient = (substituteFor: string | null = null): RecipeFormIngredient => ({
  id: createClientId(),
  ingredientId: "",
  ingredientName: "",
  quantity: "",
  unit: "",
  notes: "",
  category: null,
  substituteFor,
});

/** Add an empty "or …" row under a main ingredient row. */
export const addSubstituteRow = (
  ingredients: RecipeFormIngredient[],
  mainRowId: string
): RecipeFormIngredient[] =>
  insertSubstitute(ingredients, mainRowId, createEmptyIngredient(mainRowId));

/** Remove a row; removing a main ingredient also removes its substitutes. */
export const removeIngredientRow = (
  ingredients: RecipeFormIngredient[],
  rowId: string
): RecipeFormIngredient[] => removeRowWithSubstitutes(ingredients, rowId);

export const createEmptyRecipeFormValues = (): RecipeFormValues => ({
  title: "",
  description: "",
  sourceUrl: "",
  prepMinutes: "",
  cookMinutes: "",
  servings: "",
  tags: "",
  instructions: "",
  ingredients: [createEmptyIngredient()],
});

export const mapRecipeDetailToFormValues = (recipe: RecipeDetail): RecipeFormValues => ({
  title: recipe.title,
  description: recipe.description ?? "",
  sourceUrl: recipe.sourceUrl ?? "",
  prepMinutes: recipe.prepMinutes ? String(recipe.prepMinutes) : "",
  cookMinutes: recipe.cookMinutes ? String(recipe.cookMinutes) : "",
  servings: recipe.servings ? String(recipe.servings) : "",
  tags: recipe.tags.join(", "),
  instructions: recipe.instructions ?? "",
  ingredients:
    recipe.ingredients.length > 0
      ? recipe.ingredients.map((ingredient) => ({
          id: ingredient.id,
          ingredientId: ingredient.ingredientId,
          ingredientName: ingredient.ingredientName,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
          notes: ingredient.notes,
          category: null, // category lives on the ingredients table, not recipe_ingredients
          substituteFor: ingredient.substituteFor,
        }))
      : [createEmptyIngredient()],
});

export const mapRecipeFormValuesToInput = (
  values: RecipeFormValues
): RecipeUpsertInput => ({
  title: values.title.trim(),
  description: values.description,
  sourceUrl: values.sourceUrl,
  prepMinutes: parseOptionalNumber(values.prepMinutes),
  cookMinutes: parseOptionalNumber(values.cookMinutes),
  servings: parseOptionalNumber(values.servings),
  tags: parseTags(values.tags),
  instructions: values.instructions,
  ingredients: values.ingredients.map((ingredient) => ({
    clientId: ingredient.id,
    ingredientId: ingredient.ingredientId,
    ingredientName: ingredient.ingredientName,
    quantity: ingredient.quantity,
    unit: ingredient.unit,
    notes: ingredient.notes,
    category: ingredient.category,
    substituteFor: ingredient.substituteFor,
  })),
});
