// AI recipe import and generation through the import-recipes edge function.

import { FunctionsHttpError } from "@supabase/functions-js";
import { supabase } from "../../../lib/supabaseClient";
import type { ImportedRecipe, RecipeImportResult } from "../types";
import { importedIngredientWarnings } from "../utils/importedIngredients";
import { readImportResponse } from "../utils/importResponse";

/** Add warnings for ingredient names a person should check (brands, lists, placeholders). */
const withIngredientWarnings = (recipe: ImportedRecipe): ImportedRecipe => ({
  ...recipe,
  warnings: [...(recipe.warnings ?? []), ...importedIngredientWarnings(recipe.ingredients ?? [])],
});

/** The function's JSON is checked (readImportResponse), not trusted as typed. */
const toImportResult = (data: unknown): RecipeImportResult => {
  const { recipes, warnings } = readImportResponse(data);
  return { recipes: recipes.map(withIngredientWarnings), warnings };
};

const errorFrom = (data: unknown): string | null =>
  typeof data === "object" && data !== null && "error" in data && typeof data.error === "string" ? data.error : null;

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

  const { data, error } = await supabase.functions.invoke<unknown>(
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

  const functionError = errorFrom(data);
  if (functionError) {
    throw new Error(functionError);
  }

  return toImportResult(data);
}

export async function generateRecipesFromPrompt(
  prompt: string
): Promise<RecipeImportResult> {
  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) {
    throw new Error("Describe the recipe or recipes you want to generate.");
  }

  const { data, error } = await supabase.functions.invoke<unknown>(
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

  const functionError = errorFrom(data);
  if (functionError) {
    throw new Error(functionError);
  }

  return toImportResult(data);
}
