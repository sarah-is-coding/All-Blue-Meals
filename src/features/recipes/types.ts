import type { IngredientCategory } from "../ingredients/types";

export type RecipeSortOption = "newest" | "oldest" | "title_asc" | "title_desc";

/** How the recipes page shows recipes: the list, or folders by tag. */
export type RecipeListView = "list" | "tags";

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
  /** The catalog ingredient's store department ("meat_seafood"). */
  category: IngredientCategory | null;
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

/** A dated note on a recipe ("doubled the garlic, needed 10 more minutes"). */
export type RecipeNote = {
  id: string;
  body: string;
  /** ISO timestamps; updatedAt is later than createdAt once edited. */
  createdAt: string;
  updatedAt: string;
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
  /** From AI import: the common name for the same item, used to link synonyms. */
  canonicalName?: string | null;
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

// Matches supabase/functions/import-recipes/schema.ts. canonicalName and
// substitutes are optional: responses from an older deployed function lack them.
export type ImportedIngredientOption = {
  ingredientName: string;
  /** Common grocery name for the same item ("scallions" → "green onion"). */
  canonicalName?: string;
  quantity: string;
  unit: string;
  notes: string;
  /** As the function returned it; mapped to a code (toCategoryCode) before use. */
  category: string | null;
};

export type ImportedRecipeIngredient = ImportedIngredientOption & {
  /** Alternatives ("or avocado oil"), each with its own amount. */
  substitutes?: ImportedIngredientOption[];
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
