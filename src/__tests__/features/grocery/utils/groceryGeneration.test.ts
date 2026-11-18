import { describe, expect, it } from "vitest";
import {
  groupItemsByCategory,
  isWater,
  mergeIngredients,
} from "../../../../features/grocery/utils/groceryGeneration";
import type { IngredientCategory } from "../../../../features/ingredients/types";

// Helper: build a scaled ingredient with category defaulting to null
function ing(
  ingredientName: string,
  quantity: string,
  unit: string,
  category: IngredientCategory | null = null
) {
  return { ingredientName, quantity, unit, category };
}

describe("mergeIngredients", () => {
  it("returns an empty array for empty input", () => {
    expect(mergeIngredients([])).toEqual([]);
  });

  it("passes a single ingredient through unchanged", () => {
    const result = mergeIngredients([ing("butter", "2", "tbsp", "dairy_eggs")]);
    expect(result).toEqual([
      { ingredientName: "butter", quantity: "2", unit: "tbsp", category: "dairy_eggs", substitutes: [] },
    ]);
  });

  it("sums numeric quantities for the same ingredient and unit", () => {
    const result = mergeIngredients([
      ing("flour", "1", "cup", "baking"),
      ing("flour", "2", "cup", "baking"),
    ]);
    expect(result).toEqual([
      { ingredientName: "flour", quantity: "3", unit: "cup", category: "baking", substitutes: [] },
    ]);
  });

  it("treats different units as separate entries", () => {
    const result = mergeIngredients([
      ing("milk", "1", "cup", "dairy_eggs"),
      ing("milk", "2", "tbsp", "dairy_eggs"),
    ]);
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.unit === "cup")?.quantity).toBe("1");
    expect(result.find((r) => r.unit === "tbsp")?.quantity).toBe("2");
  });

  it("de-dupes case-insensitively on name and unit", () => {
    const result = mergeIngredients([
      ing("Salt", "1", "tsp"),
      ing("salt", "0.5", "TSP"),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe("1.5");
    // Preserves the casing of the first occurrence
    expect(result[0].ingredientName).toBe("Salt");
  });

  it("handles non-parseable quantities (e.g. 'to taste') without crashing", () => {
    const result = mergeIngredients([
      ing("pepper", "to taste", ""),
      ing("pepper", "to taste", ""),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe("to taste");
  });

  // Previously a non-numeric amount was dropped as soon as a numeric one for the
  // same ingredient appeared (e.g. "1" + "2-3" cloves became "1"), so lists
  // under-counted. Every amount is now kept.
  it("keeps a range alongside a numeric amount instead of dropping it", () => {
    const result = mergeIngredients([
      ing("garlic", "1", "clove", "produce"),
      ing("garlic", "2-3", "clove", "produce"),
    ]);
    expect(result).toEqual([
      { ingredientName: "garlic", quantity: "1 + 2-3", unit: "clove", category: "produce", substitutes: [] },
    ]);
  });

  it("lists the numeric total first, then each distinct non-numeric amount", () => {
    const result = mergeIngredients([
      ing("salt", "a pinch", ""),
      ing("salt", "1", ""),
      ing("salt", "To taste", ""),
      ing("salt", "2", ""),
      ing("salt", "to taste", ""),
    ]);
    expect(result[0].quantity).toBe("3 + a pinch + To taste");
  });

  it("keeps every distinct non-numeric amount when there are no numbers", () => {
    const result = mergeIngredients([
      ing("cilantro", "a handful", ""),
      ing("cilantro", "to garnish", ""),
    ]);
    expect(result[0].quantity).toBe("a handful + to garnish");
  });

  it("ignores blank amounts", () => {
    const result = mergeIngredients([
      ing("lemon", "", ""),
      ing("lemon", "1", ""),
      ing("lemon", "  ", ""),
    ]);
    expect(result[0].quantity).toBe("1");
  });

  it("handles fractions", () => {
    const result = mergeIngredients([
      ing("sugar", "1/2", "cup", "baking"),
      ing("sugar", "1/4", "cup", "baking"),
    ]);
    expect(result).toHaveLength(1);
    // 0.5 + 0.25 = 0.75
    expect(result[0].quantity).toBe("0.75");
  });

  it("handles mixed fractions", () => {
    const result = mergeIngredients([
      ing("oats", "1 1/2", "cup", "baking"),
      ing("oats", "1", "cup", "baking"),
    ]);
    expect(result).toHaveLength(1);
    // 1.5 + 1 = 2.5
    expect(result[0].quantity).toBe("2.5");
  });

  it("sorts by category order then alphabetically within a category", () => {
    const result = mergeIngredients([
      ing("zucchini", "1", "", "produce"),
      ing("butter", "2", "tbsp", "dairy_eggs"),
      ing("apple", "3", "", "produce"),
      ing("flour", "1", "cup", "baking"),
    ]);
    // produce < dairy_eggs is wrong — produce(0) < dairy_eggs(2) < pantry(6)
    // within produce: apple < zucchini
    expect(result.map((r) => r.ingredientName)).toEqual([
      "apple",
      "zucchini",
      "butter",
      "flour",
    ]);
  });

  it("sorts items with null category into 'other' at the end", () => {
    const result = mergeIngredients([
      ing("mystery thing", "1", ""),         // null → other
      ing("apple", "1", "", "produce"),       // produce = index 0
    ]);
    expect(result[0].ingredientName).toBe("apple");
    expect(result[1].ingredientName).toBe("mystery thing");
  });

  it("skips entries with empty ingredient names", () => {
    const result = mergeIngredients([
      ing("", "1", "cup"),
      ing("   ", "2", "cup"),
      ing("rice", "1", "cup", "baking"),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].ingredientName).toBe("rice");
  });

  it("handles empty quantity strings", () => {
    const result = mergeIngredients([ing("garlic", "", "cloves")]);
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe("");
  });

  it("sums a decimal and an integer quantity", () => {
    const result = mergeIngredients([
      ing("oil", "0.5", "cup"),
      ing("oil", "1", "cup"),
    ]);
    expect(result[0].quantity).toBe("1.5");
  });

  it("produces a whole number when sum is exact", () => {
    const result = mergeIngredients([
      ing("eggs", "3", ""),
      ing("eggs", "3", ""),
    ]);
    expect(result[0].quantity).toBe("6");
  });
});

// Step 6 of docs/ingredient-normalization.md: merge on the catalog
// ingredient and a normalized unit, skip water, keep substitutes as options.
describe("mergeIngredients: catalog ingredients, units, water, substitutes", () => {
  it("merges rows of the same catalog ingredient even when the names differ", () => {
    const result = mergeIngredients([
      { ingredientId: "i-onion", ingredientName: "onion", quantity: "1", unit: "", category: "produce" },
      { ingredientId: "i-onion", ingredientName: "onions", quantity: "2", unit: "", category: "produce" },
    ]);
    expect(result).toEqual([
      { ingredientName: "onion", quantity: "3", unit: "", category: "produce", substitutes: [] },
    ]);
  });

  // Which can to buy: the size from a container's notes is part of its unit.
  // Other notes ("diced") are for cooking and stay off the list.
  it("keeps container sizes on the item, merging only same-size containers", () => {
    const tomatoes = (quantity: string, notes: string) => ({
      ingredientId: "i-tom", ingredientName: "crushed tomatoes", quantity, unit: "can", notes, category: "baking" as const,
    });
    const result = mergeIngredients([
      tomatoes("1", "14 oz/400 g, undrained"),
      tomatoes("2", "28 oz"),
      tomatoes("1", "28 oz, divided"),
      { ingredientId: "i-onion", ingredientName: "onion", quantity: "1", unit: "", notes: "diced", category: "produce" },
    ]);
    expect(result.map((item) => [item.ingredientName, item.quantity, item.unit])).toEqual([
      ["onion", "1", ""],
      ["crushed tomatoes", "1", "can (14 oz/400 g)"],
      ["crushed tomatoes", "3", "can (28 oz)"],
    ]);
  });

  it("takes the size from a quantity written as '15' + 'ounce can'", () => {
    const result = mergeIngredients([
      { ingredientId: "i-beans", ingredientName: "black beans", quantity: "15", unit: "ounce can", category: "baking" },
    ]);
    expect(result.map((item) => [item.quantity, item.unit])).toEqual([["1", "can (15 oz)"]]);
  });

  it("merges plural and singular names without an id by their key", () => {
    const result = mergeIngredients([ing("tomato", "1", ""), ing("Tomatoes", "2", "")]);
    expect(result.map((r) => r.quantity)).toEqual(["3"]);
  });

  it("merges different spellings of the same unit", () => {
    const result = mergeIngredients([
      ing("flour", "1", "cups", "baking"),
      ing("flour", "1", "Cup", "baking"),
      ing("flour", "2", "Tablespoons", "baking"),
    ]);
    expect(result.map((r) => [r.quantity, r.unit])).toEqual([
      ["2", "cup"],
      ["2", "tbsp"],
    ]);
  });

  it("leaves water off the list, but not other waters you buy", () => {
    const result = mergeIngredients([
      ing("water", "2", "cup"),
      ing("warm water", "1", "cup"),
      ing("boiling filtered water", "4", "cup"),
      ing("coconut water", "1", "can"),
    ]);
    expect(result.map((r) => r.ingredientName)).toEqual(["coconut water"]);
  });

  it("shows substitutes as options, merged across recipes and without the item itself", () => {
    const avocado = (quantity: string) => ({
      ingredientId: "i-avo", ingredientName: "avocado oil", quantity, unit: "tbsp", category: "baking" as const,
    });
    const result = mergeIngredients([
      { ingredientId: "i-olive", ingredientName: "olive oil", quantity: "2", unit: "tbsp", category: "baking",
        substitutes: [avocado("2")] },
      { ingredientId: "i-olive", ingredientName: "olive oil", quantity: "1", unit: "tbsp", category: "baking",
        substitutes: [avocado("1"), { ingredientId: "i-olive", ingredientName: "olive oil", quantity: "1", unit: "tbsp", category: "baking" }] },
      { ingredientId: "i-ghee", ingredientName: "ghee", quantity: "1", unit: "tbsp", category: "baking" },
    ]);
    expect(result).toEqual([
      { ingredientName: "ghee", quantity: "1", unit: "tbsp", category: "baking", substitutes: [] },
      { ingredientName: "olive oil", quantity: "3", unit: "tbsp", category: "baking", substitutes: ["avocado oil, 3 tbsp"] },
    ]);
  });

  it("shows an option without an amount by name only", () => {
    const result = mergeIngredients([
      { ingredientName: "parsley", quantity: "", unit: "", category: "produce",
        substitutes: [{ ingredientName: "cilantro", quantity: "", unit: "", category: "produce" }] },
    ]);
    expect(result[0]!.substitutes).toEqual(["cilantro"]);
  });
});

describe("isWater", () => {
  it("recognises plain water with size or state words", () => {
    for (const name of ["water", "Warm water", "boiling water", "filtered water", "ice water"]) {
      expect(isWater(name)).toBe(true);
    }
  });

  it("doesn't treat waters you buy as water", () => {
    for (const name of ["coconut water", "tonic water", "rose water", "sparkling water", ""]) {
      expect(isWater(name)).toBe(false);
    }
  });
});

describe("groupItemsByCategory", () => {
  it("returns an empty array for empty input", () => {
    expect(groupItemsByCategory([])).toEqual([]);
  });

  it("groups items by category and uses the display label", () => {
    const items = [
      { category: "produce" as IngredientCategory, ingredientName: "apple" },
      { category: "baking" as IngredientCategory, ingredientName: "flour" },
      { category: "produce" as IngredientCategory, ingredientName: "carrot" },
    ];
    const groups = groupItemsByCategory(items);
    expect(groups).toHaveLength(2);
    expect(groups[0].label).toBe("Produce");
    expect(groups[0].items.map((i) => i.ingredientName)).toEqual(["apple", "carrot"]);
    expect(groups[1].label).toBe("Baking");
  });

  it("places null-category items in 'Other'", () => {
    const items = [{ category: null, ingredientName: "mystery" }];
    const groups = groupItemsByCategory(items);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Other");
  });

  it("preserves canonical category order across groups", () => {
    const items = [
      { category: "frozen" as IngredientCategory, ingredientName: "peas" },
      { category: "produce" as IngredientCategory, ingredientName: "onion" },
      { category: "dairy_eggs" as IngredientCategory, ingredientName: "milk" },
    ];
    const groups = groupItemsByCategory(items);
    expect(groups.map((g) => g.label)).toEqual(["Produce", "Dairy & Eggs", "Frozen"]);
  });

  // Step 9: labels and order come from ingredient_categories.
  it("uses the given categories' labels and store order", () => {
    const items = [
      { category: "produce" as IngredientCategory, ingredientName: "onion" },
      { category: "deli" as IngredientCategory, ingredientName: "salami" },
    ];
    const categories = [
      { code: "deli" as const, name: "Deli Counter", description: "", sortOrder: 1 },
      { code: "produce" as const, name: "Fruit & Veg", description: "", sortOrder: 2 },
      { code: "other" as const, name: "Other", description: "", sortOrder: 3 },
    ];
    expect(groupItemsByCategory(items, categories).map((group) => group.label)).toEqual(["Deli Counter", "Fruit & Veg"]);
  });

  it("puts items in a category the list doesn't have under 'Other'", () => {
    const items = [{ category: "frozen" as IngredientCategory, ingredientName: "peas" }];
    const categories = [{ code: "other" as const, name: "Other", description: "", sortOrder: 1 }];
    expect(groupItemsByCategory(items, categories)).toEqual([{ label: "Other", items }]);
  });

  it("omits categories that have no items", () => {
    const items = [{ category: "beverages" as IngredientCategory, ingredientName: "oj" }];
    const groups = groupItemsByCategory(items);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Beverages");
  });
});
