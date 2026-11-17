import type { IngredientCategory } from "../ingredients/types";

export type RecipeSortOption = "newest" | "oldest" | "title_asc" | "title_desc";

export type RecipeListFilters = {
  sort: RecipeSortOption;
  tag: string;
  onlyWithSource: boolean;
  minRating: number;
};

export type RecipeSummary = {
  id: string;
  title: string;
  description: string | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  tags: string[];
  hasSource: boolean;
  rating: number | null;
  createdAt: string;
};

export type RecipeIngredient = {
  id: string;
  ingredientId: string;
  ingredientName: string;
  quantity: string;
  unit: string;
  notes: string;
  /** Id of the main row this is a substitute for ("or …"); null for a main ingredient. */
  substituteFor: string | null;
};

export type RecipeDetail = {
  id: string;
  title: string;
  description: string | null;
  sourceUrl: string | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  servings: number | null;
  tags: string[];
  instructions: string | null;
  rating: number | null;
  createdAt: string;
  ingredients: RecipeIngredient[];
};

export type RecipeIngredientInput = {
  /** Any id unique within the list (the form's row id); links substitutes to their main row. */
  clientId: string;
  ingredientId: string;
  ingredientName: string;
  quantity: string | null;
  unit: string | null;
  notes: string | null;
  category: IngredientCategory | null;
  /** clientId of the main row this is a substitute for; null for a main ingredient. */
  substituteFor: string | null;
};

export type RecipeUpsertInput = {
  title: string;
  description: string | null;
  sourceUrl: string | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  servings: number | null;
  tags: string[];
  instructions: string | null;
  ingredients: RecipeIngredientInput[];
};

// ── Recipe import (AI extraction and generation) ─────────────────────────

export type ImportedRecipeIngredient = {
  ingredientName: string;
  quantity: string;
  unit: string;
  notes: string;
  category: IngredientCategory | null;
};

export type ImportedRecipe = {
  title: string;
  description: string;
  sourceUrl: string | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  servings: number | null;
  tags: string[];
  instructions: string;
  ingredients: ImportedRecipeIngredient[];
  confidence: "high" | "medium" | "low";
  warnings: string[];
};

export type RecipeImportResult = {
  recipes: ImportedRecipe[];
  warnings: string[];
};
