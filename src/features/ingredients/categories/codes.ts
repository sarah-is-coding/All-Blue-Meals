// Ingredient category codes (step 9 of docs/ingredient-normalization.md):
// grocery store departments, in walking order. The ingredient_categories
// table is the source of each one's label, description and order; the codes
// are fixed here for type safety, and the fallback labels cover the moment
// before that table has loaded.

import type { CategoryInfo } from "./types";

/** Every category code, in the default walking order through the store. */
export const CATEGORY_CODES = [
  "produce",
  "meat_seafood",
  "deli",
  "dairy_eggs",
  "bakery_bread",
  "pasta_rice_grains",
  "canned_jarred",
  "baking",
  "spices_seasonings",
  "oils_sauces_condiments",
  "snacks_nuts_dried_fruit",
  "frozen",
  "beverages",
  "other",
] as const;

export type IngredientCategory = (typeof CATEGORY_CODES)[number];

// Labels until ingredient_categories has loaded; the table's names win.
const FALLBACK_LABELS: Record<IngredientCategory, string> = {
  produce: "Produce",
  meat_seafood: "Meat & Seafood",
  deli: "Deli",
  dairy_eggs: "Dairy & Eggs",
  bakery_bread: "Bakery & Bread",
  pasta_rice_grains: "Pasta, Rice & Grains",
  canned_jarred: "Canned & Jarred",
  baking: "Baking",
  spices_seasonings: "Spices & Seasonings",
  oils_sauces_condiments: "Oils, Sauces & Condiments",
  snacks_nuts_dried_fruit: "Snacks, Nuts & Dried Fruit",
  frozen: "Frozen",
  beverages: "Beverages",
  other: "Other",
};

// Values used before the codes, until phase 2 rewrites the data. "pantry"
// was split into several departments, so it has no single code.
const LEGACY_VALUES: Record<string, IngredientCategory> = {
  "meat & seafood": "meat_seafood",
  "dairy & eggs": "dairy_eggs",
  "bakery & bread": "bakery_bread",
};

/**
 * The category code for a stored or imported value: a code, or an older
 * label like "meat & seafood". Null for anything else (including "pantry").
 */
export const toCategoryCode = (value: string | null | undefined): IngredientCategory | null => {
  const normalized = (value ?? "").trim().toLowerCase();
  if ((CATEGORY_CODES as readonly string[]).includes(normalized)) return normalized as IngredientCategory;
  return LEGACY_VALUES[normalized] ?? null;
};

/** The categories in default order, used until the table loads. */
export const FALLBACK_CATEGORIES: CategoryInfo[] = CATEGORY_CODES.map((code, index) => ({
  code,
  name: FALLBACK_LABELS[code],
  description: "",
  sortOrder: index + 1,
}));
