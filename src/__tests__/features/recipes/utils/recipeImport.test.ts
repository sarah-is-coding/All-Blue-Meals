import { describe, expect, it } from "vitest";
import {
  formatImportedInstructions,
  mapImportedRecipeToFormValues,
  mapImportedRecipeToInput,
} from "../../../../features/recipes/utils/recipeImport";
import type { ImportedRecipe } from "../../../../features/recipes/types";

const importedRecipe: ImportedRecipe = {
  title: "Chicken Caesar taco salad",
  description: "A quick taco salad from notes.",
  sourceUrl: null,
  prepMinutes: 10,
  cookMinutes: 15,
  servings: 4,
  tags: ["dinner", "quick"],
  instructions: "Season chicken. Assemble salad.",
  ingredients: [
    {
      ingredientName: "ground chicken",
      quantity: "1",
      unit: "lb",
      notes: "salted and peppered",
      category: "meat_seafood",
    },
  ],
  confidence: "medium",
  warnings: [],
};

describe("recipe import mapping", () => {
  it("maps imported recipe JSON to a recipe create input", () => {
    expect(mapImportedRecipeToInput(importedRecipe)).toEqual({
      title: "Chicken Caesar taco salad",
      description: "A quick taco salad from notes.",
      sourceUrl: null,
      prepMinutes: 10,
      cookMinutes: 15,
      servings: 4,
      tags: ["dinner", "quick"],
      instructions: "Season chicken. Assemble salad.",
      // clientId and substituteFor were added in step 4 (substitutes);
      // canonicalName in step 5 (null when it equals the name or is missing).
      ingredients: [
        {
          clientId: "imported-0",
          ingredientId: "",
          ingredientName: "ground chicken",
          quantity: "1",
          unit: "lb",
          notes: "salted and peppered",
          category: "meat_seafood",
          substituteFor: null,
          canonicalName: null,
        },
      ],
    });
  });

  // Step 5 of docs/ingredient-normalization.md: the naming rules run on every
  // imported ingredient, behind the AI prompt.
  it("applies the naming rules, substitutes and canonical names to imported ingredients", () => {
    const rows = mapImportedRecipeToInput({
      ...importedRecipe,
      ingredients: [
        { ingredientName: "Large garlic cloves, minced", quantity: "2", unit: "", notes: "", category: "produce" },
        {
          ingredientName: "olive oil", canonicalName: "olive oil", quantity: "2", unit: "Tablespoons",
          notes: "null", category: "baking",
          substitutes: [{ ingredientName: "avocado oil", quantity: "2", unit: "tbsp", notes: "", category: "baking" }],
        },
        { ingredientName: "scallions", canonicalName: "Green Onion", quantity: "3", unit: "", notes: "sliced", category: "produce" },
        { ingredientName: "salt and pepper", quantity: "", unit: "", notes: "to taste", category: "baking" },
      ],
    }).ingredients;

    expect(rows.map((r) => [r.clientId, r.ingredientName, r.quantity, r.unit, r.notes, r.substituteFor, r.canonicalName])).toEqual([
      ["imported-0", "garlic", "2", "clove", "large, minced", null, null],
      ["imported-1", "olive oil", "2", "tbsp", "", null, null],
      ["imported-2", "avocado oil", "2", "tbsp", "", "imported-1", null],
      ["imported-3", "scallions", "3", "", "sliced", null, "green onion"],
      ["imported-4", "salt", "", "", "to taste", null, null],
      ["imported-5", "black pepper", "", "", "to taste", null, null],
    ]);
  });

  it("splits an 'or' written inside the name into a substitute row", () => {
    const rows = mapImportedRecipeToFormValues({
      ...importedRecipe,
      ingredients: [{ ingredientName: "chicken or beef broth", quantity: "2", unit: "cups", notes: "", category: "baking" }],
    }).ingredients;
    expect(rows.map((r) => [r.ingredientName, r.unit])).toEqual([["chicken broth", "cup"], ["beef broth", "cup"]]);
    expect(rows[1]!.substituteFor).toBe(rows[0]!.id);
  });

  it("formats numbered imported instructions onto separate lines", () => {
    expect(
      formatImportedInstructions(
        "1. Make the meatballs. 2. Make the tomato sauce. 3. Simmer until cooked."
      )
    ).toBe(
      "1. Make the meatballs.\n2. Make the tomato sauce.\n3. Simmer until cooked."
    );
  });

  it("stores imported recipe instructions with readable numbered line breaks", () => {
    const input = mapImportedRecipeToInput({
      ...importedRecipe,
      instructions:
        "1. Make the meatballs. 2. Make the tomato sauce. 3. Simmer until cooked.",
    });

    expect(input.instructions).toBe(
      "1. Make the meatballs.\n2. Make the tomato sauce.\n3. Simmer until cooked."
    );
  });
});
