import type { IngredientCategory } from "../ingredients/types";

export type GroceryItem = {
  id: string;
  ingredientName: string;
  quantity: string;
  unit: string;
  isChecked: boolean;
  category: IngredientCategory | null;
  /** Alternatives shown as options ("avocado oil, 2 tbsp"), not items to buy. */
  substitutes: string[];
};

export type GroceryList = {
  id: string;
  title: string;
  savedPlanId: string | null;
  /** The dates the list was built from (null for lists built from a saved plan). */
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  items: GroceryItem[];
};

export type GroceryListSummary = {
  id: string;
  title: string;
  savedPlanId: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
};

/** A not-yet-saved ingredient entry produced by the generation step. */
export type GroceryItemDraft = {
  ingredientName: string;
  quantity: string;
  unit: string;
  category: IngredientCategory | null;
  /** Alternatives shown as options ("avocado oil, 2 tbsp"), not items to buy. */
  substitutes: string[];
};

/** What the grocery page builds a list from: a date range on the calendar,
 *  or a saved plan. */
export type GrocerySource =
  | { kind: "range"; startIso: string; endIso: string }
  | {
      kind: "saved_plan";
      planId: string;
      planLabel: string;
      startDate: string;
      endDate: string;
    };

/** What a saved grocery list remembers it was built from. */
export type GroceryListOrigin =
  | { kind: "range"; startDate: string; endDate: string }
  | { kind: "saved_plan"; savedPlanId: string };
