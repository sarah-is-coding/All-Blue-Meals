import {
  importedIngredientRows,
  importedIngredientWarnings,
} from "../../../../features/recipes/utils/importedIngredients";
import type { ImportedRecipeIngredient } from "../../../../features/recipes/types";

const ingredient = (overrides: Partial<ImportedRecipeIngredient>): ImportedRecipeIngredient => ({
  ingredientName: "",
  quantity: "",
  unit: "",
  notes: "",
  category: "produce",
  ...overrides,
});

const ids = () => {
  let next = 0;
  return () => `r${next++}`;
};

describe("importedIngredientRows", () => {
  it("returns no rows for no ingredients", () => {
    expect(importedIngredientRows([], ids())).toEqual([]);
  });

  it("drops a line whose name is a 'no value' word", () => {
    expect(importedIngredientRows([ingredient({ ingredientName: "null" })], ids())).toEqual([]);
  });

  it("gives every row of a comma list the line's category and no canonical name", () => {
    const rows = importedIngredientRows(
      [ingredient({ ingredientName: "broccoli, zucchini, carrots", canonicalName: "veg", quantity: "3", unit: "cups" })],
      ids()
    );
    expect(rows.map((r) => [r.ingredientName, r.quantity, r.notes, r.category, r.canonicalName])).toEqual([
      ["broccoli", "", "part of 3 cup", "produce", null],
      ["zucchini", "", "part of 3 cup", "produce", null],
      ["carrots", "", "part of 3 cup", "produce", null],
    ]);
  });

  it("works with responses from the older function (no substitutes or canonical name)", () => {
    const rows = importedIngredientRows([ingredient({ ingredientName: "onion", quantity: "1" })], ids());
    expect(rows).toEqual([
      { id: "r0", ingredientName: "onion", quantity: "1", unit: "", notes: "", category: "produce", substituteFor: null, canonicalName: null },
    ]);
  });
});

describe("importedIngredientWarnings", () => {
  it("explains lists, placeholders, brands and unclear commas", () => {
    const warnings = importedIngredientWarnings([
      ingredient({ ingredientName: "broccoli, zucchini, mushrooms" }),
      ingredient({ ingredientName: "toppings" }),
      ingredient({ ingredientName: "Hershey's cocoa powder" }),
      ingredient({ ingredientName: "sourdough, the good kind" }),
    ]);
    expect(warnings).toEqual([
      '"broccoli, zucchini, mushrooms" looked like a list, so it was split into separate ingredients. Check the amounts.',
      `"toppings" isn't something you can buy. Replace it with the actual ingredients.`,
      `"Hershey's cocoa powder" includes a brand name. Consider moving the brand to the notes.`,
      'Check "sourdough, the good kind": part of it may belong in the notes.',
    ]);
  });

  it("returns nothing for clean names", () => {
    expect(importedIngredientWarnings([ingredient({ ingredientName: "garlic" })])).toEqual([]);
  });
});
