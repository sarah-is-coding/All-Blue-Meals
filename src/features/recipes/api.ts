import { FunctionsHttpError } from "@supabase/functions-js";
import { supabase } from "../../lib/supabaseClient";
import type { Tables } from "../../lib/db/database.types";
import { resolveIngredients } from "../ingredients/api";
import { ingredientKey } from "../ingredients/utils/ingredientKey";
import { parseQuantityNumber } from "../../lib/utils/quantities";
import type {
  RecipeDetail,
  RecipeIngredient,
  RecipeImportResult,
  RecipeListFilters,
  RecipeSummary,
  RecipeUpsertInput,
} from "./types";

type RecipeSummaryRow = Pick<Tables<"recipes">, "id" | "title" | "description" | "prep_minutes" | "cook_minutes" | "tags" | "source_url" | "rating" | "created_at">;

type RecipeDetailRow = Pick<Tables<"recipes">, "id" | "title" | "description" | "source_url" | "prep_minutes" | "cook_minutes" | "servings" | "tags" | "instructions" | "rating" | "created_at">;

type RecipeIngredientRow = Pick<Tables<"recipe_ingredients">, "id" | "ingredient_id" | "ingredient_name" | "quantity" | "unit" | "notes">;

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
  ingredientName: row.ingredient_name,
  quantity: row.quantity ?? "",
  unit: row.unit ?? "",
  notes: row.notes ?? "",
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

const cleanText = (value: string | null | undefined): string | null => {
  const normalized = (value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
};

const getFriendlyRecipeError = (error: { code?: string; message: string }): string => {
  if (error.code === "23505" || error.message.includes("duplicate key")) {
    return "A recipe with that title already exists. Rename it and try again.";
  }

  return error.message;
};

const getRecipePayload = (input: RecipeUpsertInput, userId: string) => ({
  user_id: userId,
  title: input.title.trim(),
  description: cleanText(input.description),
  source_url: cleanText(input.sourceUrl),
  prep_minutes: input.prepMinutes,
  cook_minutes: input.cookMinutes,
  servings: input.servings,
  tags: input.tags,
  instructions: cleanText(input.instructions),
});

const getIngredientPayload = async (recipeId: string, input: RecipeUpsertInput) => {
  // Ingredients typed or imported without a catalog id are found or created
  // in one batch, matched by key (see ingredients/api.ts resolveIngredients).
  const unresolved = input.ingredients.filter(
    (ingredient) => !ingredient.ingredientId && ingredient.ingredientName.trim()
  );
  const resolved = await resolveIngredients(
    unresolved.map((ingredient) => ({
      name: ingredient.ingredientName.trim(),
      category: ingredient.category ?? "other",
    }))
  );

  return input.ingredients
    .map((ingredient) => {
      const ingredientName = ingredient.ingredientName.trim();
      const ingredientId =
        ingredient.ingredientId ||
        (ingredientName ? resolved.get(ingredientKey(ingredientName))?.id ?? "" : "");
      const quantityText = cleanText(ingredient.quantity);
      return {
        recipe_id: recipeId,
        ingredient_id: ingredientId,
        ingredient_name: ingredientName,
        quantity: quantityText,
        quantity_numeric: quantityText ? parseQuantityNumber(quantityText) : null,
        unit: cleanText(ingredient.unit),
        notes: cleanText(ingredient.notes),
      };
    })
    .filter((ingredient) => ingredient.ingredient_name.length > 0 && ingredient.ingredient_id);
};

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

  const tag = filters.tag.trim();
  if (tag) {
    query = query.contains("tags", [tag]);
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
    .select("id,ingredient_id,ingredient_name,quantity,unit,notes")
    .eq("recipe_id", recipeId)
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

  const ingredientPayload = await getIngredientPayload(recipeRow.id, input);
  if (ingredientPayload.length > 0) {
    const { error: ingredientError } = await supabase
      .from("recipe_ingredients")
      .insert(ingredientPayload);

    if (ingredientError) {
      throw new Error(ingredientError.message);
    }
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

  const { error: deleteIngredientsError } = await supabase
    .from("recipe_ingredients")
    .delete()
    .eq("recipe_id", recipeId);

  if (deleteIngredientsError) {
    throw new Error(deleteIngredientsError.message);
  }

  const ingredientPayload = await getIngredientPayload(recipeId, input);
  if (ingredientPayload.length === 0) {
    return;
  }

  const { error: ingredientError } = await supabase
    .from("recipe_ingredients")
    .insert(ingredientPayload);

  if (ingredientError) {
    throw new Error(ingredientError.message);
  }
}

// ── Recipe import: AI extraction and generation (edge functions) ─────────

type ImportRecipesResponse = RecipeImportResult & {
  error?: string;
};

/**
 * When an edge function returns a non-2xx status, Supabase wraps it in a
 * FunctionsHttpError whose `.message` is always the generic
 * "Edge Function returned a non-2xx status code" string.  The real message
 * from the function body is in `.context` (the raw Response).  This helper
 * pulls that out so the UI can show something meaningful.
 */
async function resolveEdgeFunctionError(error: unknown): Promise<Error> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as { error?: string };
      if (body?.error) {
        return new Error(body.error);
      }
    } catch {
      // Body wasn't JSON — fall through to the generic message.
    }
  }
  return error instanceof Error
    ? error
    : new Error("An unexpected error occurred.");
}

export async function extractRecipesFromText(text: string): Promise<RecipeImportResult> {
  const trimmedText = text.trim();
  if (!trimmedText) {
    throw new Error("Paste recipe notes, links, or both before importing.");
  }

  const { data, error } = await supabase.functions.invoke<ImportRecipesResponse>(
    "import-recipes",
    {
      body: { mode: "import", text: trimmedText },
    }
  );

  if (error) {
    throw await resolveEdgeFunctionError(error);
  }

  if (!data) {
    throw new Error("The recipe importer did not return a response.");
  }

  if (data.error) {
    throw new Error(data.error);
  }

  return {
    recipes: data.recipes ?? [],
    warnings: data.warnings ?? [],
  };
}

export async function generateRecipesFromPrompt(
  prompt: string
): Promise<RecipeImportResult> {
  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) {
    throw new Error("Describe the recipe or recipes you want to generate.");
  }

  const { data, error } = await supabase.functions.invoke<ImportRecipesResponse>(
    "import-recipes",
    {
      body: { mode: "generate", text: trimmedPrompt },
    }
  );

  if (error) {
    throw await resolveEdgeFunctionError(error);
  }

  if (!data) {
    throw new Error("The recipe generator did not return a response.");
  }

  if (data.error) {
    throw new Error(data.error);
  }

  return {
    recipes: data.recipes ?? [],
    warnings: data.warnings ?? [],
  };
}
