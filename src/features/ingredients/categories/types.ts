import type { IngredientCategory } from "./codes";

/** One row of ingredient_categories. */
export type CategoryInfo = {
  code: IngredientCategory;
  /** Label shown in the app, e.g. "Meat & Seafood". */
  name: string;
  /** What belongs here; also what the import prompt is told. */
  description: string;
  /** Grocery-aisle order. */
  sortOrder: number;
};
