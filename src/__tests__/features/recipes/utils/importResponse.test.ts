import { readImportResponse } from "../../../../features/recipes/utils/importResponse";

const ingredient = { ingredientName: "garlic", quantity: "2", unit: "clove", notes: "", category: "produce" };
const recipe = {
  title: "Garlic Soup",
  description: "Cozy.",
  sourceUrl: null,
  prepMinutes: 10,
  cookMinutes: null,
  servings: 4,
  tags: ["soup"],
  instructions: "Simmer.",
  ingredients: [ingredient],
  confidence: "medium",
  warnings: [],
};

describe("readImportResponse", () => {
  it("reads well-formed drafts and warnings", () => {
    expect(readImportResponse({ recipes: [recipe], warnings: ["Could not read https://x."] })).toEqual({
      recipes: [recipe],
      warnings: ["Could not read https://x."],
    });
  });

  it("leaves out entries that aren't usable recipes, and says so", () => {
    const result = readImportResponse({ recipes: [recipe, { title: "No ingredients" }, 7], warnings: [] });

    expect(result.recipes).toEqual([recipe]);
    expect(result.warnings).toEqual(["2 recipes couldn't be read and were left out."]);
  });

  it("drops malformed ingredients and fills in missing optional fields", () => {
    const [read] = readImportResponse({
      recipes: [{ title: "Toast", ingredients: [ingredient, { ingredientName: 5 }], confidence: "sure" }],
    }).recipes;

    expect(read).toEqual({
      title: "Toast",
      description: "",
      sourceUrl: null,
      prepMinutes: null,
      cookMinutes: null,
      servings: null,
      tags: [],
      instructions: "",
      ingredients: [ingredient],
      confidence: "low",
      warnings: [],
    });
  });

  it("returns nothing for a response that isn't the expected shape", () => {
    expect(readImportResponse(null)).toEqual({ recipes: [], warnings: [] });
    expect(readImportResponse({ recipes: "soup" })).toEqual({ recipes: [], warnings: [] });
  });
});
