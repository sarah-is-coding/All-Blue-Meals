import { normalizeIngredientLine } from "../../../../features/ingredients/utils/ingredientLine";

describe("normalizeIngredientLine", () => {
  it("cleans the name, unit and notes of an imported line", () => {
    const result = normalizeIngredientLine({
      ingredientName: "Large garlic cloves, minced",
      quantity: "2",
      unit: "",
      notes: "",
    });
    expect(result.lines).toEqual([
      { ingredientName: "garlic", quantity: "2", unit: "clove", notes: "large, minced", substitutes: [] },
    ]);
  });

  it("keeps a product name as written", () => {
    const result = normalizeIngredientLine({
      ingredientName: "diced tomatoes",
      quantity: "1",
      unit: "(14.5 ounce) can",
      notes: "",
    });
    expect(result.lines[0]).toEqual({
      ingredientName: "diced tomatoes",
      quantity: "1",
      unit: "can",
      notes: "14.5 oz",
      substitutes: [],
    });
  });

  // Real rows from 2026-07-13 had quantity = unit = "null".
  it("clears 'null' text and merges notes without repeats", () => {
    const result = normalizeIngredientLine({
      ingredientName: "Onions",
      quantity: "null",
      unit: "null",
      notes: "chopped, roasted",
    });
    expect(result.lines[0]).toMatchObject({
      ingredientName: "onions",
      quantity: "",
      unit: "",
      notes: "chopped, roasted",
    });
  });

  it("moves a size used as the unit into notes", () => {
    const result = normalizeIngredientLine({
      ingredientName: "onion",
      quantity: "1",
      unit: "medium",
      notes: "diced",
    });
    expect(result.lines[0]).toMatchObject({ ingredientName: "onion", unit: "", notes: "medium, diced" });
  });

  it("gives substitutes the same amount", () => {
    const result = normalizeIngredientLine({
      ingredientName: "olive or avocado oil",
      quantity: "2",
      unit: "Tablespoons",
      notes: "",
    });
    expect(result.lines).toEqual([
      {
        ingredientName: "olive oil",
        quantity: "2",
        unit: "tbsp",
        notes: "",
        substitutes: [{ ingredientName: "avocado oil", quantity: "2", unit: "tbsp", notes: "" }],
      },
    ]);
  });

  it("splits staples that share the amount", () => {
    const result = normalizeIngredientLine({
      ingredientName: "salt and pepper",
      quantity: "",
      unit: "to taste",
      notes: "",
    });
    expect(result.lines.map((line) => [line.ingredientName, line.notes])).toEqual([
      ["salt", "to taste"],
      ["black pepper", "to taste"],
    ]);
  });

  it("splits a list without dividing up the amount, keeping it as a note", () => {
    const result = normalizeIngredientLine({
      ingredientName: "broccoli, zucchini, mushrooms",
      quantity: "4",
      unit: "cups",
      notes: "",
    });
    expect(result.flags).toContain("list");
    expect(result.lines.map((line) => [line.ingredientName, line.quantity, line.notes])).toEqual([
      ["broccoli", "", "part of 4 cup"],
      ["zucchini", "", "part of 4 cup"],
      ["mushrooms", "", "part of 4 cup"],
    ]);
  });

  it("returns no lines for an empty name", () => {
    expect(
      normalizeIngredientLine({ ingredientName: "null", quantity: "1", unit: "cup", notes: "" })
    ).toEqual({ lines: [], flags: [] });
  });
});
