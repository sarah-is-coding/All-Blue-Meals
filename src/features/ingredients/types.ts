import type { IngredientCategory } from "./categories/codes";

// Category codes, labels and order live in ./categories (step 9).
export type { IngredientCategory } from "./categories/codes";
export type { CategoryInfo } from "./categories/types";

export type Ingredient = {
  id: string;
  name: string;
  category: IngredientCategory | null;
  defaultUnit: string | null;
};

/** A search result: the ingredient, and the alias it was found by, if any. */
export type IngredientMatch = Ingredient & {
  /** e.g. "scallions" when searching "scall" finds green onion. */
  matchedAlias: string | null;
};
