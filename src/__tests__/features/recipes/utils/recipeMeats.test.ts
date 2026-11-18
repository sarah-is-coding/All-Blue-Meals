import type { RecipeIngredient } from "../../../../features/recipes/types";
import { meatsIn } from "../../../../features/recipes/utils/recipeMeats";

const row = (ingredientName: string, overrides: Partial<RecipeIngredient> = {}): RecipeIngredient => ({
  id: ingredientName,
  ingredientId: `i-${ingredientName}`,
  ingredientName,
  quantity: "1",
  unit: "",
  notes: "",
  substituteFor: null,
  category: "meat_seafood",
  ...overrides,
});

describe("meatsIn", () => {
  it("lists the recipe's meat and seafood in recipe order", () => {
    expect(
      meatsIn([
        row("chicken thighs"),
        row("garlic", { category: "produce" }),
        row("bacon"),
        row("shrimp"),
      ])
    ).toEqual(["chicken thighs", "bacon", "shrimp"]);
  });

  it("leaves out substitutes and lists each meat once", () => {
    expect(
      meatsIn([
        row("ground beef"),
        row("ground turkey", { substituteFor: "ground beef" }),
        row("Ground Beef", { id: "again" }),
      ])
    ).toEqual(["ground beef"]);
  });

  it("returns nothing for a recipe without meat, or with no ingredients", () => {
    expect(meatsIn([row("tofu", { category: "produce" }), row("rice", { category: null })])).toEqual([]);
    expect(meatsIn([])).toEqual([]);
  });

  it("ignores rows without a name", () => {
    expect(meatsIn([row("  ")])).toEqual([]);
  });
});
