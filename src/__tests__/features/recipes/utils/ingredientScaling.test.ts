import { scaleRecipeFormIngredientQuantities } from "../../../../features/recipes/utils/ingredientScaling";
import type { RecipeFormIngredient } from "../../../../features/recipes/utils/recipeForm";

// ─────────────────────────────────────────────────────────────
// scaleRecipeFormIngredientQuantities
// ─────────────────────────────────────────────────────────────
describe("scaleRecipeFormIngredientQuantities", () => {
  const baseIngredients: RecipeFormIngredient[] = [
    {
      id: "row-1",
      ingredientId: "canonical-1",
      ingredientName: "chicken breast",
      quantity: "2",
      unit: "lbs",
      notes: "",
      category: null,
      substituteFor: null,
    },
    {
      id: "row-2",
      ingredientId: "canonical-2",
      ingredientName: "olive oil",
      quantity: "to taste",
      unit: "",
      notes: "extra virgin",
      category: null,
      substituteFor: null,
    },
  ];

  it("scales numeric quantities across all ingredients", () => {
    const result = scaleRecipeFormIngredientQuantities(baseIngredients, 2, 4);
    expect(result[0].quantity).toBe("4");
  });

  it("leaves freeform quantities unchanged", () => {
    const result = scaleRecipeFormIngredientQuantities(baseIngredients, 2, 4);
    expect(result[1].quantity).toBe("to taste");
  });

  it("preserves all other fields including ingredientId", () => {
    const result = scaleRecipeFormIngredientQuantities(baseIngredients, 2, 4);
    expect(result[0].ingredientId).toBe("canonical-1");
    expect(result[0].unit).toBe("lbs");
    expect(result[1].notes).toBe("extra virgin");
  });

  it("returns a new array without mutating the original", () => {
    const result = scaleRecipeFormIngredientQuantities(baseIngredients, 2, 4);
    expect(result).not.toBe(baseIngredients);
    expect(baseIngredients[0].quantity).toBe("2");
  });
});
