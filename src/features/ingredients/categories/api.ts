import { supabase } from "../../../lib/supabaseClient";
import type { Tables } from "../../../lib/db/database.types";
import { toCategoryCode } from "./codes";
import type { CategoryInfo } from "./types";

type CategoryRow = Pick<Tables<"ingredient_categories">, "id" | "name" | "description" | "sort_order">;

/** Every ingredient category, in grocery-aisle order. Rows with an unknown code are skipped. */
export async function listIngredientCategories(): Promise<CategoryInfo[]> {
  const { data, error } = await supabase
    .from("ingredient_categories")
    .select("id,name,description,sort_order")
    .order("sort_order", { ascending: true })
    .returns<CategoryRow[]>();
  if (error) throw new Error(error.message);

  return (data ?? []).flatMap((row) => {
    const code = toCategoryCode(row.id);
    return code ? [{ code, name: row.name, description: row.description, sortOrder: row.sort_order }] : [];
  });
}

/**
 * Give an uncategorized ingredient ("other" or empty) a real category. The
 * database function only ever upgrades such rows, so this can't move an
 * ingredient between two real categories. Best effort: false on failure.
 */
export async function upgradeIngredientCategory(ingredientId: string, category: string): Promise<boolean> {
  try {
    const { error } = await supabase.rpc("upgrade_ingredient_category", {
      p_ingredient_id: ingredientId,
      p_category: category,
    });
    return !error;
  } catch {
    return false;
  }
}
