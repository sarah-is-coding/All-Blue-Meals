import {
  parseServingsValue,
  scaleIngredientsToServings,
  scaleRecipeFormIngredientQuantities,
} from "../../../../features/recipes/utils/ingredientScaling";
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

// ─────────────────────────────────────────────────────────────
// parseServingsValue / scaleIngredientsToServings (moved out of
// RecipeDetailPage so the page stays under 300 lines)
// ─────────────────────────────────────────────────────────────
describe("parseServingsValue", () => {
  it("parses whole and decimal numbers, rounding", () => {
    expect(parseServingsValue("4")).toBe(4);
    expect(parseServingsValue(2.6)).toBe(3);
  });

  it("returns null for empty, zero, negative or non-numeric input", () => {
    for (const value of [null, undefined, "", "  ", "0", "-2", "abc"]) {
      expect(parseServingsValue(value)).toBeNull();
    }
  });
});

describe("scaleIngredientsToServings", () => {
  const rows = [
    { id: "r", ingredientId: "i", ingredientName: "rice", quantity: "1", unit: "cup", notes: "", category: null, substituteFor: null },
  ];

  it("scales every quantity to the servings entered", () => {
    const result = scaleIngredientsToServings(rows, 2, "4");
    expect(result).toMatchObject({ kind: "scaled", servings: 4 });
    expect(result.kind === "scaled" && result.ingredients[0]!.quantity).toBe("2");
    expect(result.message).toBe("Scaled ingredient quantities from 2 to 4 servings.");
  });

  it("does nothing when the servings already match", () => {
    expect(scaleIngredientsToServings(rows, 4, "4").kind).toBe("unchanged");
  });

  it("explains what's missing instead of scaling", () => {
    expect(scaleIngredientsToServings(rows, 2, "")).toEqual({
      kind: "error",
      message: "Enter a valid servings value before scaling ingredients.",
    });
    expect(scaleIngredientsToServings(rows, null, "4")).toEqual({
      kind: "error",
      message: "Set base servings first before scaling ingredient quantities.",
    });
  });
});
