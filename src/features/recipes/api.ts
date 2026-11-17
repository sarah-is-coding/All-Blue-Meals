import { FunctionsHttpError } from "@supabase/functions-js";
import { supabase } from "../../lib/supabaseClient";
import type { Tables } from "../../lib/db/database.types";
import { resolveIngredients } from "../ingredients/api";
import { ingredientKey } from "../ingredients/utils/ingredientKey";
import { parseQuantityNumber } from "../../lib/utils/quantities";
import { cleanMissingText, joinNotes } from "../../lib/utils/text";
import { normalizeUnit } from "../../lib/utils/units";
import { groupSubstitutes } from "./utils/ingredientGroups";
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

type RecipeIngredientRow = Pick<
  Tables<"recipe_ingredients">,
  "id" | "ingredient_id" | "ingredient_name" | "quantity" | "unit" | "notes" | "substitute_for"
>;

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
  substituteFor: row.substitute_for,
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

// Empty, whitespace-only and "no value" words ("null", "n/a") are saved as null.
const cleanText = (value: string | null | undefined): string | null =>
  cleanMissingText(value) || null;

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

/**
 * The rows save_recipe_ingredients stores, in display order: each main
 * ingredient followed by its substitutes, which carry `substitute_of` (the
 * index of their main row in this list). Units get one spelling each
 * ("Tablespoons" → "tbsp"); text that was in the unit field but isn't a unit
 * ("large", "(15 oz)") moves to the notes. Blank rows are dropped; a
 * substitute whose main row was blank becomes a main ingredient.
 */
const getIngredientRows = async (input: RecipeUpsertInput) => {
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

  const saved = input.ingredients
    .map((ingredient) => {
      const ingredientName = ingredient.ingredientName.trim();
      const ingredientId =
        ingredient.ingredientId ||
        (ingredientName ? resolved.get(ingredientKey(ingredientName))?.id ?? "" : "");
      const quantityText = cleanText(ingredient.quantity);
      const unit = normalizeUnit(ingredient.unit);
      return {
        id: ingredient.clientId,
        substituteFor: ingredient.substituteFor,
        row: {
          ingredient_id: ingredientId,
          ingredient_name: ingredientName,
          quantity: quantityText,
          quantity_numeric: quantityText ? parseQuantityNumber(quantityText) : null,
          unit: unit.unit || null,
          notes: joinNotes([...unit.notes, ingredient.notes]) || null,
        },
      };
    })
    .filter(({ row }) => row.ingredient_name.length > 0 && row.ingredient_id);

  // Main rows first, each followed by its substitutes pointing at its index.
  const rows: Array<(typeof saved)[number]["row"] & { substitute_of: number | null }> = [];
  for (const group of groupSubstitutes(saved)) {
    const mainIndex = rows.length;
    rows.push({ ...group.main.row, substitute_of: null });
    for (const substitute of group.substitutes) {
      rows.push({ ...substitute.row, substitute_of: mainIndex });
    }
  }
  return rows;
};

/**
 * Replace a recipe's ingredients in one transaction (save_recipe_ingredients
 * migration): either the new list is saved or the old one stays.
 */
const saveIngredients = async (recipeId: string, input: RecipeUpsertInput) => {
  const rows = await getIngredientRows(input);
  const { error } = await supabase.rpc("save_recipe_ingredients", {
    p_recipe_id: recipeId,
    p_rows: rows,
  });
  if (error) {
    throw new Error(error.message);
  }
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
    .select("id,ingredient_id,ingredient_name,quantity,unit,notes,substitute_for")
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
