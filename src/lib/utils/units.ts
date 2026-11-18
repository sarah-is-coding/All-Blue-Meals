// Normalize free-text ingredient units ("Tablespoons", "tsp.", "lbs") to one
// spelling each, so grocery lists can merge "2 cups" with "1 cup".
// Units are never converted (3 tsp stays 3 tsp, not 1 tbsp).

import { cleanMissingText } from "./text";

export type NormalizedUnit = {
  /** Canonical unit, or "" when there is none. */
  unit: string;
  /** Text that was in the unit field but belongs in the notes. */
  notes: string[];
  /**
   * The unit names a container size without a number ("ounce can", "g jar"),
   * so the line's quantity is the size, not a count: "15 ounce can" is one
   * 15 oz can. Callers move the quantity into the notes (see applySizeQuantity).
   */
  sizeUnit?: string;
};

/**
 * Apply a container size written as quantity + unit ("15" + "ounce can"):
 * the quantity becomes "1" and "15 oz" goes to the notes. Other lines are
 * returned unchanged.
 */
export const applySizeQuantity = (
  quantity: string,
  normalized: NormalizedUnit
): { quantity: string; unit: string; notes: string[] } => {
  const amount = quantity.trim();
  if (!normalized.sizeUnit || !amount) {
    return { quantity, unit: normalized.unit, notes: normalized.notes };
  }
  return { quantity: "1", unit: normalized.unit, notes: [`${amount} ${normalized.sizeUnit}`, ...normalized.notes] };
};

// Every spelling (lowercase, without a trailing ".") → canonical unit.
const UNIT_SPELLINGS: Record<string, string[]> = {
  cup: ["cup", "cups", "c"],
  tsp: ["tsp", "tsps", "teaspoon", "teaspoons"],
  tbsp: ["tbsp", "tbsps", "tbs", "tbl", "tablespoon", "tablespoons"],
  lb: ["lb", "lbs", "pound", "pounds"],
  oz: ["oz", "ozs", "ounce", "ounces"],
  "fl oz": ["fl oz", "fluid ounce", "fluid ounces"],
  g: ["g", "gs", "gram", "grams", "gr"],
  kg: ["kg", "kgs", "kilogram", "kilograms"],
  ml: ["ml", "mls", "milliliter", "milliliters", "millilitre", "millilitres"],
  l: ["l", "liter", "liters", "litre", "litres"],
  pint: ["pint", "pints", "pt"],
  quart: ["quart", "quarts", "qt"],
  gallon: ["gallon", "gallons", "gal"],
  clove: ["clove", "cloves"],
  slice: ["slice", "slices"],
  stalk: ["stalk", "stalks"],
  sprig: ["sprig", "sprigs"],
  bunch: ["bunch", "bunches"],
  head: ["head", "heads"],
  piece: ["piece", "pieces"],
  stick: ["stick", "sticks"],
  sheet: ["sheet", "sheets"],
  loaf: ["loaf", "loaves"],
  can: ["can", "cans"],
  jar: ["jar", "jars"],
  bottle: ["bottle", "bottles"],
  box: ["box", "boxes"],
  bag: ["bag", "bags"],
  package: ["package", "packages", "pkg", "pkgs", "packet", "packets", "pack", "packs"],
  container: ["container", "containers", "carton", "cartons", "tub", "tubs"],
  pinch: ["pinch", "pinches"],
  dash: ["dash", "dashes"],
  handful: ["handful", "handfuls"],
  drop: ["drop", "drops"],
  drizzle: ["drizzle", "drizzles"],
  inch: ["inch", "inches", "in"],
};

const CANONICAL_BY_SPELLING = new Map<string, string>(
  Object.entries(UNIT_SPELLINGS).flatMap(([canonical, spellings]) =>
    spellings.map((spelling) => [spelling, canonical] as const)
  )
);

// Words that describe the ingredient, not a unit ("2 large" onions).
const NOTE_ONLY_UNITS = new Set([
  "small", "medium", "large", "extra large", "extra-large", "medium-large", "jumbo",
  "whole", "fresh", "diced", "chopped", "minced", "sliced", "halved", "uncooked",
  "cooked", "to taste", "as needed", "optional", "all sides", "touch",
]);

// Words that mean "one of the thing" and carry no information.
const EMPTY_UNITS = new Set(["unit", "units", "each", "ea", "whole item", "item", "items", "x"]);

// Containers that can carry a size: "(15 ounce) can", "28-ounce can", "13.5oz cans".
const CONTAINER_UNITS = new Set(["can", "jar", "bottle", "box", "bag", "package", "container"]);

// "15 oz", "14 oz/400 g", "13.5 fl oz", "1-2 lb".
const SIZE_UNIT = "(?:fl\\.? ?oz|oz|g|kg|ml|l|lb)";
const SIZE_NOTE = new RegExp(
  `^\\d+(?:\\.\\d+)?(?:\\s*-\\s*\\d+(?:\\.\\d+)?)?\\s*${SIZE_UNIT}(?:\\s*/\\s*\\d+(?:\\.\\d+)?\\s*${SIZE_UNIT})?$`,
  "i"
);

/**
 * The size of a container from its notes ("1 can", notes "15 oz, drained" →
 * "15 oz"): what to look for at the store. Null for units that aren't
 * containers ("2 tbsp", notes "15 oz" isn't a size of anything).
 */
export const containerSize = (unit: string, notes: string | null | undefined): string | null => {
  if (!CONTAINER_UNITS.has(unit)) return null;
  const size = (notes ?? "")
    .split(",")
    .map((part) => part.trim())
    .find((part) => SIZE_NOTE.test(part));
  return size ?? null;
};

const lookupUnit = (text: string): string | null => {
  const bare = text.toLowerCase().replace(/\.$/, "").trim();
  return CANONICAL_BY_SPELLING.get(bare) ?? null;
};

// "15 ounce" / "14 oz/400g" / "8-ounce" → "15 oz" / "14 oz/400g" / "8 oz"
const tidySize = (size: string): string =>
  size
    .replace(/(\d)\s*-\s*(?=[a-z])/gi, "$1 ")
    .replace(/(\d)(?=[a-z])/gi, "$1 ")
    .split(" ")
    .map((word) => lookupUnit(word) ?? word)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Normalize a unit field. Returns the canonical unit plus any text that
 * belongs in the ingredient's notes instead (sizes, prep words, metric
 * equivalents in parentheses).
 */
export const normalizeUnit = (value: string | null | undefined): NormalizedUnit => {
  let text = cleanMissingText(value);
  const notes: string[] = [];

  // Pull parenthesised text out as notes: "cup (1 stick)", "(60ml)", "(15 oz.) can".
  text = text
    .replace(/\(([^)]*)\)/g, (_match, inner: string) => {
      const cleaned = cleanMissingText(inner);
      if (cleaned) notes.push(tidySize(cleaned));
      return " ";
    })
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return { unit: "", notes };

  const lower = text.toLowerCase();
  if (EMPTY_UNITS.has(lower)) return { unit: "", notes };
  if (NOTE_ONLY_UNITS.has(lower)) return { unit: "", notes: [lower, ...notes] };

  const direct = lookupUnit(text);
  if (direct) return { unit: direct, notes };

  // Size + container: "ounce can", "28-ounce can", "13.5oz cans", "32 oz. jar", "g pack".
  const words = lower.split(" ");
  const last = words[words.length - 1] ?? "";
  const container = lookupUnit(last);
  if (container && CONTAINER_UNITS.has(container) && words.length > 1) {
    const size = tidySize(words.slice(0, -1).join(" ").replace(/^x\s+/, ""));
    // "ounce can", "g jar", "oz. carton": a size unit with no number.
    if (size && !/\d/.test(size) && lookupUnit(size)) {
      return { unit: container, notes, sizeUnit: lookupUnit(size) ?? size };
    }
    return { unit: container, notes: size ? [size, ...notes] : notes };
  }
  // Container first: "can (4 oz.)" is handled above via parentheses; "can 4 oz" here.
  const first = words[0] ?? "";
  const leadingContainer = lookupUnit(first);
  if (leadingContainer && CONTAINER_UNITS.has(leadingContainer) && words.length > 1) {
    return { unit: leadingContainer, notes: [tidySize(words.slice(1).join(" ")), ...notes] };
  }

  // Unit followed by a description: "cup loosely packed".
  if (leadingContainer && words.length > 1) {
    return { unit: leadingContainer, notes: [words.slice(1).join(" "), ...notes] };
  }

  // Unknown: keep it, lowercased, so nothing is lost.
  return { unit: lower, notes };
};
