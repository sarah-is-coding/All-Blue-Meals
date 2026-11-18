import { CATEGORY_CODES, FALLBACK_CATEGORIES } from "../../ingredients/categories/codes";
import type { CategoryInfo, IngredientCategory } from "../../ingredients/types";
import { ingredientKey } from "../../ingredients/utils/ingredientKey";
import { parseName } from "../../ingredients/utils/ingredientText";
import { parseQuantityNumber } from "../../../lib/utils/quantities";
import { addMeasure, formatMeasure, measureOf, type MeasureTotal } from "../../../lib/utils/measures";
import { applySizeQuantity, containerSize, normalizeUnit } from "../../../lib/utils/units";
import type { GroceryItemDraft } from "../types";

export type ScaledIngredient = {
  /** Catalog ingredient id; rows merge on it. Falls back to the name's key when missing. */
  ingredientId?: string;
  ingredientName: string;
  quantity: string;
  unit: string;
  /** The recipe row's notes; only a container size ("15 oz") reaches the list. */
  notes?: string;
  category: IngredientCategory | null;
  /** Alternatives shown as options on the item, not bought ("or avocado oil"). */
  substitutes?: ScaledIngredient[];
};

// Water is in recipes but not something to buy. Matched after size/state
// words are dropped, so "warm water" and "boiling water" count; "coconut
// water" or "tonic water" don't.
const WATER_KEYS = new Set(["water", "filteredwater", "tapwater", "coldwater", "icewater", "hotwater"]);
export const isWater = (name: string): boolean => WATER_KEYS.has(ingredientKey(parseName(name.toLowerCase()).name));

/** Default walking order of each category, for sorting merged items. */
const CATEGORY_ORDER = new Map<IngredientCategory, number>(CATEGORY_CODES.map((code, index) => [code, index]));

/** Format a summed count back to a display string ("1.5", "3"). */
function formatCount(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  if (Math.abs(rounded - Math.round(rounded)) < 0.000001) {
    return String(Math.round(rounded));
  }
  return rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

/** "avocado oil, 2 tbsp" (or just the name when there's no amount). */
const formatOption = (draft: GroceryItemDraft): string => {
  const amount = [draft.quantity, draft.unit].filter(Boolean).join(" ");
  return amount ? `${draft.ingredientName}, ${amount}` : draft.ingredientName;
};

// Amounts too small to shop for: like "to taste", they leave no quantity.
const NEGLIGIBLE_UNITS = new Set(["pinch", "dash", "drop", "drizzle"]);

type Amount = { quantity: string; unit: string };

/**
 * Merge a flat list of (possibly duplicated) scaled ingredients into a
 * grocery list with one line per ingredient, sorted by category then name.
 *
 * Rows of the same catalog ingredient (or the same name key when there's no
 * id) share a line. Their amounts are added up: volumes (tsp, tbsp, cup, ml,
 * …) and weights (oz, lb, g, kg) convert within their kind and show in the
 * most readable unit, rounded up ("2 tbsp" + "1/4 cup" = "6 tbsp"); counts
 * add up per unit ("3 clove", "2 can (15 oz)": a container's size from the
 * notes is part of its unit). Amounts that can't be combined are listed side
 * by side: "6 tbsp + 20 g". Ranges ("6-10 clove") are kept as written.
 * Amounts with no number ("to taste", "for serving") and negligible ones ("a
 * pinch") are left off; an ingredient with only those has no quantity, so
 * it's still on the list to check you have it.
 * Water is left off. Substitutes become text options on their item, merged
 * the same way, without repeating the item itself.
 */
export function mergeIngredients(ingredients: ScaledIngredient[]): GroceryItemDraft[] {
  type Line = {
    ingredientName: string;
    category: IngredientCategory | null;
    substitutes: ScaledIngredient[];
    identity: string;
    volume: MeasureTotal | null;
    weight: MeasureTotal | null;
    /** Summed counts per unit ("" for plain counts), in first-seen order. */
    counts: Map<string, number>;
    /** Amounts with a number that isn't a single value ("6-10 clove"). */
    ranges: string[];
  };

  const lines = new Map<string, Line>();

  for (const ing of ingredients) {
    const nameTrimmed = ing.ingredientName.trim();
    if (!nameTrimmed || isWater(nameTrimmed)) continue;

    const identity = ing.ingredientId || ingredientKey(nameTrimmed);
    let line = lines.get(identity);
    if (!line) {
      line = {
        ingredientName: nameTrimmed,
        category: ing.category,
        substitutes: [],
        identity,
        volume: null,
        weight: null,
        counts: new Map(),
        ranges: [],
      };
      lines.set(identity, line);
    }
    line.substitutes.push(...(ing.substitutes ?? []));

    // "15" + "ounce can" (rows not yet cleaned) is one can, not 15.
    const sized = applySizeQuantity(ing.quantity.trim(), normalizeUnit(ing.unit));
    const rawQty = sized.quantity.trim();
    if (!rawQty || !/\d/.test(rawQty) || NEGLIGIBLE_UNITS.has(sized.unit)) continue;

    const size = containerSize(sized.unit, [...sized.notes, ing.notes ?? ""].join(", "));
    const unit = size ? `${sized.unit} (${size})` : sized.unit;
    const qty = parseQuantityNumber(rawQty);
    if (qty === null) {
      const written = [rawQty, unit].filter(Boolean).join(" ");
      if (!line.ranges.some((range) => range.toLowerCase() === written.toLowerCase())) line.ranges.push(written);
      continue;
    }

    const measure = measureOf(unit);
    if (measure?.kind === "volume") line.volume = addMeasure(line.volume, qty, unit);
    else if (measure?.kind === "weight") line.weight = addMeasure(line.weight, qty, unit);
    else line.counts.set(unit, (line.counts.get(unit) ?? 0) + qty);
  }

  const amountsOf = (line: Line): Amount[] => [
    ...[line.volume, line.weight].flatMap((total) => (total ? [formatMeasure(total)] : [])),
    // Plain counts ("2 onions") before counted units ("3 clove").
    ...[...line.counts.entries()]
      .sort(([a], [b]) => Number(a !== "") - Number(b !== ""))
      .map(([unit, count]) => ({ quantity: formatCount(count), unit })),
    ...line.ranges.map((range) => ({ quantity: range, unit: "" })),
  ];

  return Array.from(lines.values())
    .map((line) => {
      const amounts = amountsOf(line);
      // One amount keeps its unit separate; several read as one text.
      const [only] = amounts;
      const amount =
        amounts.length === 1 && only
          ? only
          : {
              quantity: amounts.map((part) => [part.quantity, part.unit].filter(Boolean).join(" ")).join(" + "),
              unit: "",
            };
      return {
        ingredientName: line.ingredientName,
        quantity: amount.quantity,
        unit: amount.unit,
        category: line.category,
        substitutes: mergeIngredients(
          line.substitutes.filter(
            (option) => (option.ingredientId || ingredientKey(option.ingredientName)) !== line.identity
          )
        ).map(formatOption),
      };
    })
    .sort((a, b) => {
      const catA = CATEGORY_ORDER.get(a.category ?? "other") ?? CATEGORY_CODES.length;
      const catB = CATEGORY_ORDER.get(b.category ?? "other") ?? CATEGORY_CODES.length;
      if (catA !== catB) return catA - catB;
      return a.ingredientName.localeCompare(b.ingredientName);
    });
}

/**
 * Group a list of items by their `category` field, in the categories' store
 * order and with their labels (from ingredient_categories). Items with no
 * category, or one not in the list, fall into "Other". Categories that have
 * no items are omitted.
 */
export function groupItemsByCategory<
  T extends { category: IngredientCategory | null }
>(items: T[], categories: CategoryInfo[] = FALLBACK_CATEGORIES): Array<{ label: string; items: T[] }> {
  const known = new Set(categories.map((category) => category.code));
  const grouped = new Map<IngredientCategory, T[]>();
  for (const item of items) {
    const code: IngredientCategory = item.category && known.has(item.category) ? item.category : "other";
    grouped.set(code, [...(grouped.get(code) ?? []), item]);
  }
  return [...categories]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .filter((category) => grouped.has(category.code))
    .map((category) => ({ label: category.name, items: grouped.get(category.code)! }));
}
