import type { IngredientCategory } from "../ingredients/types";

/** An item on the list as shown: a built item with its place and tick. */
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

/** An item produced by building the list. */
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
