// Ingredient categories (grocery store departments) read from the
// ingredient_categories table, so the prompt and the response schema use the
// same codes and descriptions as the app (step 9 of
// docs/ingredient-normalization.md). Read as the signed-in user; the table is
// readable by any signed-in user.

import { type Category, parseCategories } from "./validate.ts";

export type { Category };

export const loadCategories = async (authorization: string): Promise<Category[]> => {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY.");

  const response = await fetch(
    `${url}/rest/v1/ingredient_categories?select=id,name,description&order=sort_order.asc`,
    { headers: { apikey: anonKey, Authorization: authorization } }
  );
  if (!response.ok) throw new Error(`Loading categories failed (${response.status}).`);
  const categories = parseCategories(await response.json());
  if (categories.length === 0) throw new Error("No ingredient categories found.");
  return categories;
};

/** One line per category for the prompt: `"produce" (Produce): Fresh vegetables, …` */
export const describeCategories = (categories: Category[]): string =>
  categories.map((category) => `  - "${category.id}" (${category.name}): ${category.description}`).join("\n");
