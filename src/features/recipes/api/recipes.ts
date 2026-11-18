// Recipe reads and writes: list, detail, create, update, rate, delete.

import { supabase } from "../../../lib/supabaseClient";
import type { Tables } from "../../../lib/db/database.types";
import type {
  RecipeDetail,
  RecipeIngredient,
  RecipeListFilters,
  RecipeSummary,
  RecipeUpsertInput,
} from "../types";
import { cleanMissingMultilineText } from "../../../lib/utils/text";
import { toCategoryCode } from "../../ingredients/categories/codes";
import { cleanText, saveIngredients } from "./ingredientRows";

const cleanMultilineText = (value: string | null | undefined): string | null =>
  cleanMissingMultilineText(value) || null;

type RecipeSummaryRow = Pick<Tables<"recipes">, "id" | "title" | "description" | "prep_minutes" | "cook_minutes" | "tags" | "source_url" | "rating" | "created_at">;

type RecipeDetailRow = Pick<Tables<"recipes">, "id" | "title" | "description" | "source_url" | "prep_minutes" | "cook_minutes" | "servings" | "tags" | "instructions" | "rating" | "created_at">;

// The name comes from the catalog, not recipe_ingredients.ingredient_name
// (dropped in step 8 of docs/ingredient-normalization.md).
type RecipeIngredientRow = Pick<
  Tables<"recipe_ingredients">,
  "id" | "ingredient_id" | "quantity" | "unit" | "notes" | "substitute_for"
> & { ingredients: Pick<Tables<"ingredients">, "name" | "category"> | null };

type RecipeIdRow = Pick<Tables<"recipes">, "id">;

const mapRecipeSummaryRow = (row: RecipeSummaryRow): RecipeSummary => ({
  id: row.id,
  title: row.title,
  description: row.description,
  prepMinutes: row.prep_minutes,
  cookMinutes: row.cook_minutes,
  tags: row.tags ?? [],
  hasSource: Boolean(row.source_url),
  rating: row.rating,
  createdAt: row.created_at,
});

const mapRecipeIngredientRow = (row: RecipeIngredientRow): RecipeIngredient => ({
  id: row.id,
  ingredientId: row.ingredient_id,
  ingredientName: row.ingredients?.name ?? "",
  quantity: row.quantity ?? "",
  unit: row.unit ?? "",
  notes: row.notes ?? "",
  substituteFor: row.substitute_for,
  category: toCategoryCode(row.ingredients?.category),
});

const mapRecipeDetail = (row: RecipeDetailRow, ingredients: RecipeIngredient[]): RecipeDetail => ({
  id: row.id,
  title: row.title,
  description: row.description,
  sourceUrl: row.source_url,
  prepMinutes: row.prep_minutes,
  cookMinutes: row.cook_minutes,
  servings: row.servings,
  tags: row.tags ?? [],
  instructions: row.instructions,
  rating: row.rating,
  createdAt: row.created_at,
  ingredients,
});


const getFriendlyRecipeError = (error: { code?: string; message: string }): string => {
  if (error.code === "23505" || error.message.includes("duplicate key")) {
    return "A recipe with that title already exists. Rename it and try again.";
  }

  return error.message;
};

const getRecipePayload = (input: RecipeUpsertInput, userId: string) => ({
  user_id: userId,
  title: input.title.trim(),
  // Multi-line fields keep their line breaks (one step per line); cleanText
  // would collapse them into one paragraph.
  description: cleanMultilineText(input.description),
  source_url: cleanText(input.sourceUrl),
  prep_minutes: input.prepMinutes,
  cook_minutes: input.cookMinutes,
  servings: input.servings,
  tags: input.tags,
  instructions: cleanMultilineText(input.instructions),
});

async function requireUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message);
  }

  if (!user) {
    throw new Error("You must be signed in to manage recipes.");
  }

  return user.id;
}

type RecipeListPageInput = {
  page: number;
  pageSize: number;
};

type RecipeListPageResult = {
  recipes: RecipeSummary[];
  totalCount: number;
};

/** Every recipe's tags (only that column), for the "Tag folders" view. */
export async function listRecipeTags(): Promise<string[][]> {
  const { data, error } = await supabase
    .from("recipes")
    .select("tags")
    .returns<Array<Pick<Tables<"recipes">, "tags">>>();
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => row.tags ?? []);
}

export async function listRecipes(
  searchTerm: string,
  filters: RecipeListFilters,
  pagination: RecipeListPageInput
): Promise<RecipeListPageResult> {
  const safePage = Math.max(1, Math.floor(pagination.page));
  const safePageSize = Math.max(1, Math.floor(pagination.pageSize));
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;

  let query = supabase
    .from("recipes")
    .select(
      "id,title,description,prep_minutes,cook_minutes,tags,source_url,rating,created_at",
      { count: "exact" }
    )
    .range(from, to);

  const trimmedSearch = searchTerm.trim();
  if (trimmedSearch) {
    query = query.ilike("title", `%${trimmedSearch}%`);
  }

  // Case doesn't matter: tags_lower is the recipe's tags in lowercase.
  const tag = filters.tag.trim().toLowerCase();
  if (tag) {
    query = query.contains("tags_lower", [tag]);
  }

  if (filters.onlyWithSource) {
    query = query.not("source_url", "is", null);
  }

  if (filters.minRating > 0) {
    query = query.gte("rating", filters.minRating);
  }

  switch (filters.sort) {
    case "oldest":
      query = query.order("created_at", { ascending: true });
      break;
    case "title_asc":
      query = query.order("title", { ascending: true });
      break;
    case "title_desc":
      query = query.order("title", { ascending: false });
      break;
    case "newest":
    default:
      query = query.order("created_at", { ascending: false });
      break;
  }

  const { data, error, count } = await query.returns<RecipeSummaryRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return {
    recipes: (data ?? []).map(mapRecipeSummaryRow),
    totalCount: count ?? 0,
  };
}

export async function getRecipeById(recipeId: string): Promise<RecipeDetail | null> {
  const { data: recipeRow, error: recipeError } = await supabase
    .from("recipes")
    .select(
      "id,title,description,source_url,prep_minutes,cook_minutes,servings,tags,instructions,rating,created_at"
    )
    .eq("id", recipeId)
    .maybeSingle<RecipeDetailRow>();

  if (recipeError) {
    throw new Error(getFriendlyRecipeError(recipeError));
  }

  if (!recipeRow) {
    return null;
  }

  const { data: ingredientRows, error: ingredientError } = await supabase
    .from("recipe_ingredients")
    .select("id,ingredient_id,quantity,unit,notes,substitute_for,ingredients(name,category)")
    .eq("recipe_id", recipeId)
    .order("position", { ascending: true })
    // Rows saved by older app versions all have position 0.
    .order("created_at", { ascending: true })
    .returns<RecipeIngredientRow[]>();

  if (ingredientError) {
    throw new Error(ingredientError.message);
  }

  return mapRecipeDetail(recipeRow, (ingredientRows ?? []).map(mapRecipeIngredientRow));
}

export async function createRecipe(input: RecipeUpsertInput): Promise<string> {
  if (!input.title.trim()) {
    throw new Error("Title is required.");
  }

  const userId = await requireUserId();
  const { data: recipeRow, error: recipeError } = await supabase
    .from("recipes")
    .insert(getRecipePayload(input, userId))
    .select("id")
    .single<RecipeIdRow>();

  if (recipeError) {
    throw new Error(getFriendlyRecipeError(recipeError));
  }

  try {
    await saveIngredients(recipeRow.id, input);
  } catch (error) {
    // Don't leave a new recipe behind with no ingredients; the user can retry.
    await supabase.from("recipes").delete().eq("id", recipeRow.id);
    throw error;
  }

  return recipeRow.id;
}

export async function rateRecipe(recipeId: string, rating: number | null): Promise<void> {
  const { error } = await supabase.from("recipes").update({ rating }).eq("id", recipeId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteRecipe(recipeId: string): Promise<void> {
  const { error } = await supabase.from("recipes").delete().eq("id", recipeId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateRecipe(recipeId: string, input: RecipeUpsertInput): Promise<void> {
  if (!input.title.trim()) {
    throw new Error("Title is required.");
  }

  const userId = await requireUserId();
  const { error: recipeError } = await supabase
    .from("recipes")
    .update(getRecipePayload(input, userId))
    .eq("id", recipeId);

  if (recipeError) {
    throw new Error(recipeError.message);
  }

  await saveIngredients(recipeId, input);
}
