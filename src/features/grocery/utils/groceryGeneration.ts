import {
  INGREDIENT_CATEGORIES,
  type IngredientCategory,
} from "../../ingredients/types";
import { ingredientKey } from "../../ingredients/utils/ingredientKey";
import { parseName } from "../../ingredients/utils/ingredientText";
import { parseQuantityNumber } from "../../../lib/utils/quantities";
import { applySizeQuantity, normalizeUnit } from "../../../lib/utils/units";
import type { GroceryItemDraft } from "../types";

export type ScaledIngredient = {
  /** Catalog ingredient id; rows merge on it. Falls back to the name's key when missing. */
  ingredientId?: string;
  ingredientName: string;
  quantity: string;
  unit: string;
  category: IngredientCategory | null;
  /** Alternatives shown as options on the item, not bought ("or avocado oil"). */
  substitutes?: ScaledIngredient[];
};

// Water is in recipes but not something to buy. Matched after size/state
// words are dropped, so "warm water" and "boiling water" count; "coconut
// water" or "tonic water" don't.
const WATER_KEYS = new Set(["water", "filteredwater", "tapwater", "coldwater", "icewater", "hotwater"]);
export const isWater = (name: string): boolean => WATER_KEYS.has(ingredientKey(parseName(name.toLowerCase()).name));

/** Display label for each ingredient category. */
const CATEGORY_LABELS: Record<IngredientCategory, string> = {
  produce: "Produce",
  "meat & seafood": "Meat & Seafood",
  "dairy & eggs": "Dairy & Eggs",
  "bakery & bread": "Bakery & Bread",
  pantry: "Pantry",
  frozen: "Frozen",
  beverages: "Beverages",
  other: "Other",
};

/** The sort-order index for each category. */
const CATEGORY_ORDER = new Map<IngredientCategory, number>(
  INGREDIENT_CATEGORIES.map((cat, i) => [cat, i])
);

/** Format a merged numeric quantity back to a display string. */
function formatMergedQuantity(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  if (Math.abs(rounded - Math.round(rounded)) < 0.000001) {
    return String(Math.round(rounded));
  }
  // e.g. 1.5 → "1.5", 0.75 → "0.75"
  return rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

/** "avocado oil, 2 tbsp" (or just the name when there's no amount). */
const formatOption = (draft: GroceryItemDraft): string => {
  const amount = [draft.quantity, draft.unit].filter(Boolean).join(" ");
  return amount ? `${draft.ingredientName}, ${amount}` : draft.ingredientName;
};

/**
 * Merge a flat list of (possibly duplicated) scaled ingredients into a
 * de-duped grocery list, sorted by ingredient category then alphabetically.
 *
 * Grouping key: the catalog ingredient (or the name's key when there's no
 * id) + the normalized unit, so "onions, 2 cups" and "onion, 1 cup" merge.
 * Numeric amounts ("2", "1 1/2") are summed. Amounts that aren't numbers
 * ("2-3", "a pinch", "to taste") are never dropped: each distinct one is kept
 * alongside the total, e.g. "1 + 2-3", so nothing is silently under-bought.
 * Water is left off. Substitutes become text options on their item, merged
 * the same way, without repeating the item itself.
 */
export function mergeIngredients(ingredients: ScaledIngredient[]): GroceryItemDraft[] {
  type Bucket = {
    ingredientName: string;
    unit: string;
    numericTotal: number | null;
    /** Distinct non-numeric amounts, in first-seen order. */
    otherAmounts: string[];
    category: IngredientCategory | null;
    substitutes: ScaledIngredient[];
    identity: string;
  };

  const buckets = new Map<string, Bucket>();

  for (const ing of ingredients) {
    const nameTrimmed = ing.ingredientName.trim();
    if (!nameTrimmed || isWater(nameTrimmed)) continue;

    // "15" + "ounce can" (rows not yet cleaned) is one can, not 15.
    const sized = applySizeQuantity(ing.quantity.trim(), normalizeUnit(ing.unit));
    const unit = sized.unit;
    const identity = ing.ingredientId || ingredientKey(nameTrimmed);
    const key = `${identity}|${unit}`;
    const rawQty = sized.quantity.trim();
    const qty = rawQty ? parseQuantityNumber(rawQty) : null;

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        ingredientName: nameTrimmed,
        unit,
        numericTotal: null,
        otherAmounts: [],
        category: ing.category,
        substitutes: [],
        identity,
      };
      buckets.set(key, bucket);
    }

    if (qty !== null) {
      bucket.numericTotal = (bucket.numericTotal ?? 0) + qty;
    } else if (
      rawQty &&
      !bucket.otherAmounts.some((amount) => amount.toLowerCase() === rawQty.toLowerCase())
    ) {
      bucket.otherAmounts.push(rawQty);
    }
    bucket.substitutes.push(...(ing.substitutes ?? []));
  }

  return Array.from(buckets.values())
    .map(({ ingredientName, unit, numericTotal, otherAmounts, category, substitutes, identity }) => ({
      ingredientName,
      unit,
      quantity: [
        ...(numericTotal !== null ? [formatMergedQuantity(numericTotal)] : []),
        ...otherAmounts,
      ].join(" + "),
      category,
      substitutes: mergeIngredients(
        substitutes.filter((option) => (option.ingredientId || ingredientKey(option.ingredientName)) !== identity)
      ).map(formatOption),
    }))
    .sort((a, b) => {
      const catA = CATEGORY_ORDER.get(a.category ?? "other") ?? INGREDIENT_CATEGORIES.length;
      const catB = CATEGORY_ORDER.get(b.category ?? "other") ?? INGREDIENT_CATEGORIES.length;
      if (catA !== catB) return catA - catB;
      return a.ingredientName.localeCompare(b.ingredientName);
    });
}

/**
 * Group a list of items by their `category` field, preserving the canonical
 * category display order. Items with `null` category fall into "Other".
 * Categories that have no items are omitted.
 */
export function groupItemsByCategory<
  T extends { category: IngredientCategory | null }
>(items: T[]): Array<{ label: string; items: T[] }> {
  const grouped = new Map<IngredientCategory, T[]>();
  for (const item of items) {
    const cat: IngredientCategory = item.category ?? "other";
    const group = grouped.get(cat) ?? [];
    group.push(item);
    grouped.set(cat, group);
  }
  return INGREDIENT_CATEGORIES.filter((cat) => grouped.has(cat)).map((cat) => ({
    label: CATEGORY_LABELS[cat],
    items: grouped.get(cat)!,
  }));
}
