export type IngredientCategory =
  | "produce"
  | "meat & seafood"
  | "dairy & eggs"
  | "bakery & bread"
  | "pantry"
  | "frozen"
  | "beverages"
  | "other";

export const INGREDIENT_CATEGORIES: IngredientCategory[] = [
  "produce",
  "meat & seafood",
  "dairy & eggs",
  "bakery & bread",
  "pantry",
  "frozen",
  "beverages",
  "other",
];

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
