// The JSON shape Gemini must return (its responseSchema format). The app reads
// this as ImportedRecipe in src/features/recipes/types.ts; keep them in step.
// Every field is required so the model never omits one; "missing" is "".

// Built per request: the category codes come from ingredient_categories.
export const buildRecipeSchema = (categoryCodes: string[]) => {
  // One ingredient as you'd buy it. canonicalName is the common grocery name for
  // the same item ("scallions" → "green onion"), used to link synonyms.
  const ingredientFields = {
    ingredientName: { type: "STRING" },
    canonicalName: { type: "STRING" },
    quantity: { type: "STRING" },
    unit: { type: "STRING" },
    notes: { type: "STRING" },
    category: { type: "STRING", enum: categoryCodes },
  };
  const ingredientRequired = ["ingredientName", "canonicalName", "quantity", "unit", "notes", "category"];

  const ingredientSchema = {
    type: "OBJECT",
    properties: {
      ...ingredientFields,
      // Alternatives ("or avocado oil"), each with its own amount.
      substitutes: {
        type: "ARRAY",
        items: { type: "OBJECT", properties: ingredientFields, required: ingredientRequired },
      },
    },
    required: [...ingredientRequired, "substitutes"],
  };

  return {
    type: "OBJECT",
    properties: {
      recipes: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            title: { type: "STRING" },
            description: { type: "STRING" },
            sourceUrl: { type: "STRING", nullable: true },
            prepMinutes: { type: "INTEGER", nullable: true },
            cookMinutes: { type: "INTEGER", nullable: true },
            servings: { type: "INTEGER", nullable: true },
            tags: { type: "ARRAY", items: { type: "STRING" } },
            instructions: { type: "STRING" },
            ingredients: { type: "ARRAY", items: ingredientSchema },
            confidence: { type: "STRING", enum: ["high", "medium", "low"] },
            warnings: { type: "ARRAY", items: { type: "STRING" } },
          },
          required: [
            "title",
            "description",
            "sourceUrl",
            "prepMinutes",
            "cookMinutes",
            "servings",
            "tags",
            "instructions",
            "ingredients",
            "confidence",
            "warnings",
          ],
        },
      },
      warnings: { type: "ARRAY", items: { type: "STRING" } },
    },
    required: ["recipes", "warnings"],
  };
};
