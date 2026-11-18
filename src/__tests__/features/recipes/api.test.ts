import { describe, expect, it, vi, beforeEach } from "vitest";

// Saving resolves ingredients in one batch (step 2 of
// docs/ingredient-normalization.md) instead of one createIngredient per row.
vi.mock("../../../features/ingredients/api", () => ({
  resolveIngredients: vi.fn().mockResolvedValue(new Map()),
}));

vi.mock("../../../lib/supabaseClient", () => {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};

  const chained = [
    "from",
    "insert",
    "select",
    "eq",
    "delete",
    "update",
    "range",
    "order",
    "gte",
  ];

  for (const method of chained) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }

  builder.single = vi.fn().mockResolvedValue({
    data: { id: "recipe-1" },
    error: null,
  });

  builder.returns = vi.fn().mockResolvedValue({ data: [], error: null, count: 0 });
  builder.rpc = vi.fn().mockResolvedValue({ data: null, error: null });

  const mockAuth = {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    }),
  };

  return { supabase: { ...builder, auth: mockAuth } };
});

import { supabase } from "../../../lib/supabaseClient";
import { resolveIngredients } from "../../../features/ingredients/api";
import type { RecipeIngredientInput } from "../../../features/recipes/types";
import {
  createRecipe,
  deleteRecipe,
  getRecipeById,
  listRecipes,
  rateRecipe,
  updateRecipe,
} from "../../../features/recipes/api";
import { mapImportedRecipeToInput } from "../../../features/recipes/utils/recipeImport";

const db = supabase as unknown as Record<string, ReturnType<typeof vi.fn>>;

const CHAINED_METHODS = [
  "from",
  "insert",
  "select",
  "eq",
  "delete",
  "update",
  "range",
  "order",
  "gte",
];

const defaultFilters = {
  sort: "newest" as const,
  tag: "",
  onlyWithSource: false,
  minRating: 0,
};

let lineCount = 0;
const line = (overrides: Partial<RecipeIngredientInput>): RecipeIngredientInput => ({
  clientId: `line-${(lineCount += 1)}`,
  ingredientId: "",
  ingredientName: "",
  quantity: "",
  unit: "",
  notes: "",
  category: null,
  substituteFor: null,
  ...overrides,
});

const recipeInput = {
  title: "Chicken Caesar Taco Salad",
  description: null,
  sourceUrl: null,
  prepMinutes: null,
  cookMinutes: null,
  servings: null,
  tags: [],
  instructions: null,
  ingredients: [],
};

describe("recipe api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const method of CHAINED_METHODS) {
      db[method].mockReturnValue(db);
    }
    db.single.mockResolvedValue({
      data: { id: "recipe-1" },
      error: null,
    });
    db.returns.mockResolvedValue({ data: [], error: null, count: 0 });
    db.rpc.mockResolvedValue({ data: null, error: null });
  });

  it("returns a friendly error when a recipe title already exists", async () => {
    db.single.mockResolvedValueOnce({
      data: null,
      error: {
        code: "23505",
        message:
          'duplicate key value violates unique constraint "recipes_user_id_title_key"',
      },
    });

    await expect(createRecipe(recipeInput)).rejects.toThrow(
      "A recipe with that title already exists. Rename it and try again."
    );
  });

  it("resolves ingredients without an id in one batch and saves their ids", async () => {
    vi.mocked(resolveIngredients).mockResolvedValueOnce(
      new Map([["onion", { id: "ing-onion", name: "onion", category: "produce", defaultUnit: null }]])
    );

    await createRecipe({
      ...recipeInput,
      ingredients: [
        line({ ingredientId: "ing-oil", ingredientName: "Olive oil", quantity: "2", unit: "tbsp" }),
        line({ ingredientName: " Onions ", quantity: "1", notes: "diced", category: "produce" }),
        line({ ingredientName: "  " }),
      ],
    });

    expect(resolveIngredients).toHaveBeenCalledTimes(1);
    expect(resolveIngredients).toHaveBeenCalledWith([{ name: "Onions", category: "produce", canonicalName: null }]);
    // Step 3: rows go to save_recipe_ingredients in display order (one
    // transaction) instead of a direct insert into recipe_ingredients.
    expect(db.rpc).toHaveBeenCalledWith("save_recipe_ingredients", {
      p_recipe_id: "recipe-1",
      p_rows: [
        expect.objectContaining({ ingredient_id: "ing-oil", quantity_numeric: 2 }),
        expect.objectContaining({ ingredient_id: "ing-onion", notes: "diced" }),
      ],
    });
  });

  // Regression: step 3 cleaned these fields with the ingredient-text cleaner,
  // which collapsed every newline, so saved steps became one paragraph.
  it("keeps line breaks in instructions and description when creating a recipe", async () => {
    await createRecipe({
      ...recipeInput,
      description: "Quick weeknight dinner.\nServe warm.",
      instructions: "1. Preheat the oven.\r\n2. Toss   the vegetables.\n\n\n3. Roast for 20 minutes.  ",
    });

    expect(db.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Quick weeknight dinner.\nServe warm.",
        instructions: "1. Preheat the oven.\n2. Toss the vegetables.\n\n3. Roast for 20 minutes.",
      })
    );
  });

  it("saves an imported recipe with one step per line", async () => {
    // The AI sometimes returns all steps in one paragraph; the import puts
    // each numbered step on its own line, and saving must keep them.
    const input = mapImportedRecipeToInput({
      title: "Roast vegetables",
      description: "",
      sourceUrl: null,
      prepMinutes: null,
      cookMinutes: null,
      servings: null,
      tags: [],
      instructions: "1. Preheat the oven. 2. Toss the vegetables with oil. 3. Roast for 20 minutes.",
      ingredients: [],
      confidence: "high",
      warnings: [],
    });

    await createRecipe(input);

    expect(db.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        instructions: "1. Preheat the oven.\n2. Toss the vegetables with oil.\n3. Roast for 20 minutes.",
      })
    );
  });

  it("keeps line breaks in instructions when editing a recipe", async () => {
    await updateRecipe("recipe-1", { ...recipeInput, instructions: "1. Boil water.\n2. Add pasta." });

    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({ instructions: "1. Boil water.\n2. Add pasta." })
    );
  });

  it("saves blank or 'null' instructions and description as null", async () => {
    await createRecipe({ ...recipeInput, description: "  \n ", instructions: "null" });

    expect(db.insert).toHaveBeenCalledWith(expect.objectContaining({ description: null, instructions: null }));
  });

  it("normalizes units and clears 'null' text when saving", async () => {
    await createRecipe({
      ...recipeInput,
      ingredients: [
        line({ ingredientId: "ing-oil", ingredientName: "olive oil", quantity: "2", unit: "Tablespoons", notes: "null" }),
        line({ ingredientId: "ing-onion", ingredientName: "onion", quantity: "1", unit: "large", notes: "diced" }),
        line({ ingredientId: "ing-tom", ingredientName: "diced tomatoes", quantity: "null", unit: "(15 ounce) can" }),
      ],
    });

    expect(db.rpc).toHaveBeenCalledWith("save_recipe_ingredients", {
      p_recipe_id: "recipe-1",
      p_rows: [
        { ingredient_id: "ing-oil", quantity: "2", quantity_numeric: 2, unit: "tbsp", notes: null, substitute_of: null },
        { ingredient_id: "ing-onion", quantity: "1", quantity_numeric: 1, unit: null, notes: "large, diced", substitute_of: null },
        { ingredient_id: "ing-tom", quantity: null, quantity_numeric: null, unit: "can", notes: "15 oz", substitute_of: null },
      ],
    });
  });

  // Step 4: substitutes are saved right after their main row and point at
  // its index in the list (save_recipe_ingredients links them).
  it("saves substitutes after their main row with the main row's index", async () => {
    await createRecipe({
      ...recipeInput,
      ingredients: [
        line({ clientId: "a", ingredientId: "ing-oil", ingredientName: "olive oil" }),
        line({ clientId: "b", ingredientId: "ing-salt", ingredientName: "salt" }),
        // Out of order in the form: still saved directly under "a".
        line({ clientId: "c", ingredientId: "ing-avo", ingredientName: "avocado oil", substituteFor: "a" }),
      ],
    });

    const rows = vi.mocked(db.rpc).mock.calls[0][1].p_rows;
    expect(rows.map((row: { ingredient_id: string; substitute_of: number | null }) => [row.ingredient_id, row.substitute_of])).toEqual([
      ["ing-oil", null],
      ["ing-avo", 0],
      ["ing-salt", null],
    ]);
  });

  it("saves a substitute as a main row when its main row was left blank", async () => {
    await createRecipe({
      ...recipeInput,
      ingredients: [
        line({ clientId: "a", ingredientName: "  " }),
        line({ clientId: "b", ingredientId: "ing-avo", ingredientName: "avocado oil", substituteFor: "a" }),
      ],
    });

    expect(vi.mocked(db.rpc).mock.calls[0][1].p_rows).toEqual([
      expect.objectContaining({ ingredient_id: "ing-avo", substitute_of: null }),
    ]);
  });

  it("removes a new recipe and throws when its ingredients can't be saved", async () => {
    db.rpc.mockResolvedValueOnce({ data: null, error: { message: "insert failed" } });

    await expect(createRecipe(recipeInput)).rejects.toThrow("insert failed");

    expect(db.from).toHaveBeenCalledWith("recipes");
    expect(db.delete).toHaveBeenCalled();
    expect(db.eq).toHaveBeenLastCalledWith("id", "recipe-1");
  });

  it("replaces an edited recipe's ingredients through the atomic save", async () => {
    db.eq.mockReturnValueOnce(Promise.resolve({ data: null, error: null }));

    await updateRecipe("recipe-7", recipeInput);

    expect(db.rpc).toHaveBeenCalledWith("save_recipe_ingredients", { p_recipe_id: "recipe-7", p_rows: [] });
    // No separate delete-then-insert any more.
    expect(db.delete).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("throws when the atomic save fails on edit", async () => {
    db.eq.mockReturnValueOnce(Promise.resolve({ data: null, error: null }));
    db.rpc.mockResolvedValueOnce({ data: null, error: { message: "permission denied" } });

    await expect(updateRecipe("recipe-7", recipeInput)).rejects.toThrow("permission denied");
  });

  // Step 8 of docs/ingredient-normalization.md: recipe_ingredients.ingredient_name
  // is going away. The save function fills it from the catalog meanwhile.
  it("doesn't send ingredient_name when saving", async () => {
    await createRecipe({
      ...recipeInput,
      ingredients: [line({ ingredientId: "ing-oil", ingredientName: "Olive Oil " })],
    });

    const [row] = vi.mocked(db.rpc).mock.calls[0][1].p_rows;
    expect(row).toMatchObject({ ingredient_id: "ing-oil" });
    expect(row).not.toHaveProperty("ingredient_name");
  });

  it("shows each ingredient with its catalog name", async () => {
    db.maybeSingle = vi.fn().mockResolvedValue({ data: { id: "recipe-1", title: "T" }, error: null });
    db.returns.mockResolvedValueOnce({
      data: [
        { id: "ri-1", ingredient_id: "ing-onion", quantity: "1", unit: null, notes: "diced", substitute_for: null, ingredients: { name: "onion" } },
        { id: "ri-2", ingredient_id: "ing-gone", quantity: null, unit: null, notes: null, substitute_for: null, ingredients: null },
      ],
      error: null,
    });

    const recipe = await getRecipeById("recipe-1");

    expect(db.select).toHaveBeenCalledWith("id,ingredient_id,quantity,unit,notes,substitute_for,ingredients(name)");
    expect(recipe?.ingredients.map((ingredient) => ingredient.ingredientName)).toEqual(["onion", ""]);
  });

  it("loads ingredients in saved order", async () => {
    db.maybeSingle = vi.fn().mockResolvedValue({ data: { id: "recipe-1", title: "T" }, error: null });

    await getRecipeById("recipe-1");

    expect(db.order).toHaveBeenNthCalledWith(1, "position", { ascending: true });
    expect(db.order).toHaveBeenNthCalledWith(2, "created_at", { ascending: true });
  });

  it("deletes a recipe by id", async () => {
    db.eq.mockResolvedValueOnce({ data: null, error: null });

    await deleteRecipe("recipe-1");

    expect(db.from).toHaveBeenCalledWith("recipes");
    expect(db.delete).toHaveBeenCalled();
    expect(db.eq).toHaveBeenCalledWith("id", "recipe-1");
  });

  it("throws when deleting a recipe fails", async () => {
    db.eq.mockResolvedValueOnce({
      data: null,
      error: { message: "Recipe not found" },
    });

    await expect(deleteRecipe("recipe-1")).rejects.toThrow("Recipe not found");
  });

  it("sets a recipe's rating", async () => {
    db.eq.mockResolvedValueOnce({ data: null, error: null });

    await rateRecipe("recipe-1", 4);

    expect(db.from).toHaveBeenCalledWith("recipes");
    expect(db.update).toHaveBeenCalledWith({ rating: 4 });
    expect(db.eq).toHaveBeenCalledWith("id", "recipe-1");
  });

  it("throws when rating a recipe fails", async () => {
    db.eq.mockResolvedValueOnce({
      data: null,
      error: { message: "Recipe not found" },
    });

    await expect(rateRecipe("recipe-1", 4)).rejects.toThrow("Recipe not found");
  });

  it("applies a minimum rating filter when set", async () => {
    await listRecipes("", { ...defaultFilters, minRating: 3 }, { page: 1, pageSize: 12 });

    expect(db.gte).toHaveBeenCalledWith("rating", 3);
  });

  it("does not apply a rating filter when minRating is 0", async () => {
    await listRecipes("", { ...defaultFilters, minRating: 0 }, { page: 1, pageSize: 12 });

    expect(db.gte).not.toHaveBeenCalled();
  });
});
