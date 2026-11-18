import {
  addSubstituteRow,
  createEmptyIngredient,
  createEmptyRecipeFormValues,
  mapRecipeDetailToFormValues,
  mapRecipeFormValuesToInput,
  removeIngredientRow,
} from "../../../../features/recipes/utils/recipeForm";
import type { RecipeDetail } from "../../../../features/recipes/types";

// ─────────────────────────────────────────────────────────────
// Substitute rows (step 4 of docs/ingredient-normalization.md)
// ─────────────────────────────────────────────────────────────
describe("substitute rows", () => {
  it("adds an empty substitute row linked to its main row", () => {
    const main = createEmptyIngredient();
    const other = createEmptyIngredient();
    const rows = addSubstituteRow([main, other], main.id);

    expect(rows).toHaveLength(3);
    expect(rows[0]!.id).toBe(main.id);
    expect(rows[1]!.substituteFor).toBe(main.id);
    expect(rows[1]!.ingredientName).toBe("");
    expect(rows[2]!.id).toBe(other.id);
  });

  it("removes a main row together with its substitutes", () => {
    const main = createEmptyIngredient();
    const withSub = addSubstituteRow([main, createEmptyIngredient()], main.id);
    expect(removeIngredientRow(withSub, main.id)).toHaveLength(1);
  });

  it("creates main rows by default", () => {
    expect(createEmptyIngredient().substituteFor).toBeNull();
    expect(createEmptyIngredient("main-1").substituteFor).toBe("main-1");
  });

  it("keeps the substitute link through detail → form → input", () => {
    const recipe: RecipeDetail = {
      id: "r", title: "T", description: null, sourceUrl: null, prepMinutes: null,
      cookMinutes: null, servings: null, tags: [], instructions: null, rating: null,
      createdAt: "2026-01-01T00:00:00Z",
      ingredients: [
        { id: "ri-1", ingredientId: "i-1", ingredientName: "olive oil", quantity: "2", unit: "tbsp", notes: "", substituteFor: null, category: null },
        { id: "ri-2", ingredientId: "i-2", ingredientName: "avocado oil", quantity: "2", unit: "tbsp", notes: "", substituteFor: "ri-1", category: null },
      ],
    };
    const input = mapRecipeFormValuesToInput(mapRecipeDetailToFormValues(recipe));
    expect(input.ingredients.map((i) => [i.clientId, i.substituteFor])).toEqual([
      ["ri-1", null],
      ["ri-2", "ri-1"],
    ]);
  });
});

// ─────────────────────────────────────────────────────────────
// createEmptyIngredient
// ─────────────────────────────────────────────────────────────
describe("createEmptyIngredient", () => {
  it("returns empty strings for all text fields and null category", () => {
    const ingredient = createEmptyIngredient();
    expect(ingredient.ingredientId).toBe("");
    expect(ingredient.ingredientName).toBe("");
    expect(ingredient.quantity).toBe("");
    expect(ingredient.unit).toBe("");
    expect(ingredient.notes).toBe("");
    expect(ingredient.category).toBeNull();
  });

  it("generates a non-empty id", () => {
    const ingredient = createEmptyIngredient();
    expect(ingredient.id).toBeTruthy();
    expect(ingredient.id.length).toBeGreaterThan(0);
  });

  it("generates unique ids on each call", () => {
    const a = createEmptyIngredient();
    const b = createEmptyIngredient();
    expect(a.id).not.toBe(b.id);
  });
});

// ─────────────────────────────────────────────────────────────
// createEmptyRecipeFormValues
// ─────────────────────────────────────────────────────────────
describe("createEmptyRecipeFormValues", () => {
  it("starts with one empty ingredient row", () => {
    const values = createEmptyRecipeFormValues();
    expect(values.ingredients).toHaveLength(1);
    expect(values.ingredients[0].ingredientName).toBe("");
  });

  it("initialises all text fields to empty strings", () => {
    const values = createEmptyRecipeFormValues();
    expect(values.title).toBe("");
    expect(values.description).toBe("");
    expect(values.prepMinutes).toBe("");
    expect(values.servings).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────
// mapRecipeDetailToFormValues
// ─────────────────────────────────────────────────────────────
describe("mapRecipeDetailToFormValues", () => {
  const baseRecipe: RecipeDetail = {
    id: "recipe-1",
    title: "Chicken Stir Fry",
    description: "A quick weeknight dinner",
    sourceUrl: "https://example.com/recipe",
    prepMinutes: 10,
    cookMinutes: 20,
    servings: 4,
    tags: ["quick", "chicken"],
    instructions: "Cook the chicken.",
    createdAt: "2024-01-01T00:00:00Z",
    rating: null,
    ingredients: [
      {
        id: "ri-1",
        ingredientId: "canonical-1",
        ingredientName: "chicken breast",
        quantity: "2",
        unit: "lbs",
        notes: "boneless",
        substituteFor: null,
        category: "meat_seafood",
      },
    ],
  };

  it("maps string fields correctly", () => {
    const form = mapRecipeDetailToFormValues(baseRecipe);
    expect(form.title).toBe("Chicken Stir Fry");
    expect(form.description).toBe("A quick weeknight dinner");
    expect(form.sourceUrl).toBe("https://example.com/recipe");
    expect(form.instructions).toBe("Cook the chicken.");
  });

  it("converts numeric fields to strings", () => {
    const form = mapRecipeDetailToFormValues(baseRecipe);
    expect(form.prepMinutes).toBe("10");
    expect(form.cookMinutes).toBe("20");
    expect(form.servings).toBe("4");
  });

  it("joins tags with comma and space", () => {
    const form = mapRecipeDetailToFormValues(baseRecipe);
    expect(form.tags).toBe("quick, chicken");
  });

  it("maps ingredients including ingredientId, category is always null", () => {
    const form = mapRecipeDetailToFormValues(baseRecipe);
    expect(form.ingredients).toHaveLength(1);
    expect(form.ingredients[0].ingredientId).toBe("canonical-1");
    expect(form.ingredients[0].ingredientName).toBe("chicken breast");
    expect(form.ingredients[0].quantity).toBe("2");
    expect(form.ingredients[0].unit).toBe("lbs");
    expect(form.ingredients[0].notes).toBe("boneless");
    // category lives on the ingredients table, not on recipe_ingredients
    expect(form.ingredients[0].category).toBeNull();
  });

  it("falls back to one empty ingredient when recipe has none", () => {
    const form = mapRecipeDetailToFormValues({ ...baseRecipe, ingredients: [] });
    expect(form.ingredients).toHaveLength(1);
    expect(form.ingredients[0].ingredientName).toBe("");
    expect(form.ingredients[0].ingredientId).toBe("");
  });

  it("maps null optional fields to empty strings", () => {
    const form = mapRecipeDetailToFormValues({
      ...baseRecipe,
      description: null,
      sourceUrl: null,
      prepMinutes: null,
      cookMinutes: null,
      servings: null,
      instructions: null,
    });
    expect(form.description).toBe("");
    expect(form.sourceUrl).toBe("");
    expect(form.prepMinutes).toBe("");
    expect(form.cookMinutes).toBe("");
    expect(form.servings).toBe("");
    expect(form.instructions).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────
// mapRecipeFormValuesToInput
// ─────────────────────────────────────────────────────────────
describe("mapRecipeFormValuesToInput", () => {
  const baseFormValues = {
    title: "  Pasta  ",
    description: "Simple pasta",
    sourceUrl: "https://example.com",
    prepMinutes: "15",
    cookMinutes: "30",
    servings: "4",
    tags: "italian, quick, italian",
    instructions: "Boil pasta.",
    ingredients: [
      {
        id: "row-1",
        ingredientId: "canonical-42",
        ingredientName: "spaghetti",
        quantity: "200",
        unit: "g",
        notes: "",
        category: null,
        substituteFor: null,
      },
    ],
  };

  it("trims whitespace from the title", () => {
    const input = mapRecipeFormValuesToInput(baseFormValues);
    expect(input.title).toBe("Pasta");
  });

  it("parses numeric fields", () => {
    const input = mapRecipeFormValuesToInput(baseFormValues);
    expect(input.prepMinutes).toBe(15);
    expect(input.cookMinutes).toBe(30);
    expect(input.servings).toBe(4);
  });

  it("returns null for empty numeric fields", () => {
    const input = mapRecipeFormValuesToInput({
      ...baseFormValues,
      prepMinutes: "",
      cookMinutes: "",
      servings: "",
    });
    expect(input.prepMinutes).toBeNull();
    expect(input.cookMinutes).toBeNull();
    expect(input.servings).toBeNull();
  });

  it("returns null for invalid numeric fields", () => {
    const input = mapRecipeFormValuesToInput({
      ...baseFormValues,
      prepMinutes: "abc",
      servings: "-1",
    });
    expect(input.prepMinutes).toBeNull();
    expect(input.servings).toBeNull();
  });

  it("parses and deduplicates tags", () => {
    const input = mapRecipeFormValuesToInput(baseFormValues);
    expect(input.tags).toEqual(["italian", "quick"]);
  });

  it("returns an empty tags array for an empty string", () => {
    const input = mapRecipeFormValuesToInput({ ...baseFormValues, tags: "" });
    expect(input.tags).toEqual([]);
  });

  it("maps ingredients with ingredientId and category", () => {
    const input = mapRecipeFormValuesToInput(baseFormValues);
    expect(input.ingredients).toHaveLength(1);
    expect(input.ingredients[0].ingredientId).toBe("canonical-42");
    expect(input.ingredients[0].ingredientName).toBe("spaghetti");
    expect(input.ingredients[0].quantity).toBe("200");
    expect(input.ingredients[0].category).toBeNull();
  });
});
