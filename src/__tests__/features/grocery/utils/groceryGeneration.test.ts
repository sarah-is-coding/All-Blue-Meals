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

  // Changed: grocery lists now have one line per ingredient. Volumes convert
  // and add up (1 cup + 2 tbsp = 18 tbsp = 1 1/8 cup, shown rounded up to the
  // next 1/4 cup) instead of being a separate line per unit.
  it("adds up different volume units on one line", () => {
    const result = mergeIngredients([
      ing("milk", "1", "cup", "dairy_eggs"),
      ing("milk", "2", "tbsp", "dairy_eggs"),
    ]);
    expect(result.map((r) => [r.quantity, r.unit])).toEqual([["1 1/4", "cup"]]);
  });

  it("de-dupes case-insensitively on name and unit", () => {
    const result = mergeIngredients([
      ing("Salt", "1", "tsp"),
      ing("salt", "0.5", "TSP"),
    ]);
    expect(result).toHaveLength(1);
    // Measured totals are now shown as fractions, rounded up to a shopping step.
    expect(result[0].quantity).toBe("1 1/2");
    // Preserves the casing of the first occurrence
    expect(result[0].ingredientName).toBe("Salt");
  });

  // Changed: amounts with no number ("to taste") are left off the quantity;
  // the item stays on the list (with no amount) so you check you have it.
  it("keeps an ingredient that's only 'to taste' on the list with no amount", () => {
    const result = mergeIngredients([
      ing("pepper", "to taste", ""),
      ing("pepper", "to taste", ""),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe("");
  });

  // A range ("2-3") was once dropped when a numeric amount appeared, so
  // lists under-counted. It's still kept, now written with its own unit
  // since the line can hold several kinds of amount.
  it("keeps a range alongside a numeric amount instead of dropping it", () => {
    const result = mergeIngredients([
      ing("garlic", "1", "clove", "produce"),
      ing("garlic", "2-3", "clove", "produce"),
    ]);
    expect(result).toEqual([
      { ingredientName: "garlic", quantity: "1 clove + 2-3 clove", unit: "", category: "produce", substitutes: [] },
    ]);
  });

  // Changed: "a pinch" and "to taste" aren't shopping amounts, so only the
  // numeric total is shown (they used to be appended: "3 + a pinch + To taste").
  it("shows only the numeric total, leaving off amounts with no number", () => {
    const result = mergeIngredients([
      ing("salt", "a pinch", ""),
      ing("salt", "1", ""),
      ing("salt", "To taste", ""),
      ing("salt", "2", ""),
      ing("salt", "to taste", ""),
    ]);
    expect(result[0].quantity).toBe("3");
  });

  it("leaves off negligible units such as a pinch or a dash", () => {
    const result = mergeIngredients([
      ing("salt", "1", "pinch"),
      ing("salt", "1", "tsp"),
      ing("nutmeg", "1", "dash"),
    ]);
    expect(result.map((r) => [r.ingredientName, r.quantity, r.unit])).toEqual([
      ["nutmeg", "", ""],
      ["salt", "1", "tsp"],
    ]);
  });

  it("has no amount when no amount has a number", () => {
    const result = mergeIngredients([
      ing("cilantro", "a handful", ""),
      ing("cilantro", "to garnish", ""),
    ]);
    expect(result[0].quantity).toBe("");
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
    // 0.5 + 0.25 = 0.75, shown as a fraction (was "0.75")
    expect(result[0].quantity).toBe("3/4");
  });

  it("handles mixed fractions", () => {
    const result = mergeIngredients([
      ing("oats", "1 1/2", "cup", "baking"),
      ing("oats", "1", "cup", "baking"),
    ]);
    expect(result).toHaveLength(1);
    // 1.5 + 1 = 2.5, shown as a fraction (was "2.5")
    expect(result[0].quantity).toBe("2 1/2");
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
    expect(result[0].quantity).toBe("1 1/2");
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
    // One line per ingredient: each can size adds up on its own, side by side.
    expect(result.map((item) => [item.ingredientName, item.quantity, item.unit])).toEqual([
      ["onion", "1", ""],
      ["crushed tomatoes", "1 can (14 oz/400 g) + 3 can (28 oz)", ""],
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

  // Spellings normalize ("cups" = "Cup"), and since volumes now convert,
  // 2 cups + 2 tbsp is one amount: 2 1/8 cups, rounded up to 2 1/4.
  it("merges different spellings and sizes of volume units", () => {
    const result = mergeIngredients([
      ing("flour", "1", "cups", "baking"),
      ing("flour", "1", "Cup", "baking"),
      ing("flour", "2", "Tablespoons", "baking"),
    ]);
    expect(result.map((r) => [r.quantity, r.unit])).toEqual([["2 1/4", "cup"]]);
  });

  // The cases from the real grocery lists that prompted one line per
  // ingredient: black pepper, olive oil and garlic each came out as 2-5 lines.
  it("puts every amount of an ingredient on one line", () => {
    const pepper = (quantity: string, unit: string) => ({ ingredientId: "i-pep", ingredientName: "black pepper", quantity, unit, category: "spices_seasonings" as const });
    const oil = (quantity: string, unit: string) => ({ ingredientId: "i-oil", ingredientName: "olive oil", quantity, unit, category: "oils_sauces_condiments" as const });
    const garlic = (quantity: string, unit: string) => ({ ingredientId: "i-gar", ingredientName: "garlic", quantity, unit, category: "produce" as const });
    const result = mergeIngredients([
      pepper("1/2", "tsp"), pepper("to taste", ""), pepper("1/4", "teaspoon"),
      oil("2", "tbsp"), oil("1/4", "cup"), oil("2", "tsp"), oil("20", "g"),
      garlic("3", "cloves"), garlic("2", "clove"), garlic("1", "tbsp"),
    ]);
    expect(result.map((r) => [r.ingredientName, r.quantity, r.unit])).toEqual([
      ["garlic", "1 tbsp + 5 clove", ""],
      ["black pepper", "3/4", "tsp"],
      // 2 tbsp + 4 tbsp + 2/3 tbsp = 6 2/3 tbsp, rounded up to 7; grams can't
      // convert to volume, so they're listed alongside.
      ["olive oil", "7 tbsp + 20 g", ""],
    ]);
  });

  it("converts weights and shows metric only when every amount was metric", () => {
    const result = mergeIngredients([
      ing("beef", "1", "lb", "meat_seafood"),
      ing("beef", "8", "oz", "meat_seafood"),
      ing("rice", "500", "g", "pasta_rice_grains"),
      ing("rice", "0.75", "kg", "pasta_rice_grains"),
      ing("cheese", "100", "g", "dairy_eggs"),
      ing("cheese", "4", "oz", "dairy_eggs"),
    ]);
    expect(result.map((r) => [r.ingredientName, r.quantity, r.unit])).toEqual([
      ["beef", "1 1/2", "lb"],
      // 100 g + 4 oz = 7.53 oz, rounded up to the next 1/2 oz.
      ["cheese", "8", "oz"],
      ["rice", "1.3", "kg"],
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
