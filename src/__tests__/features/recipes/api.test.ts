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
import {
  createRecipe,
  deleteRecipe,
  getRecipeById,
  listRecipes,
  rateRecipe,
  updateRecipe,
} from "../../../features/recipes/api";

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
        { ingredientId: "ing-oil", ingredientName: "Olive oil", quantity: "2", unit: "tbsp", notes: "", category: null },
        { ingredientId: "", ingredientName: " Onions ", quantity: "1", unit: "", notes: "diced", category: "produce" },
        { ingredientId: "", ingredientName: "  ", quantity: "", unit: "", notes: "", category: null },
      ],
    });

    expect(resolveIngredients).toHaveBeenCalledTimes(1);
    expect(resolveIngredients).toHaveBeenCalledWith([{ name: "Onions", category: "produce" }]);
    // Step 3: rows go to save_recipe_ingredients in display order (one
    // transaction) instead of a direct insert into recipe_ingredients.
    expect(db.rpc).toHaveBeenCalledWith("save_recipe_ingredients", {
      p_recipe_id: "recipe-1",
      p_rows: [
        expect.objectContaining({ ingredient_id: "ing-oil", ingredient_name: "Olive oil", quantity_numeric: 2 }),
        expect.objectContaining({ ingredient_id: "ing-onion", ingredient_name: "Onions", notes: "diced" }),
      ],
    });
  });

  it("normalizes units and clears 'null' text when saving", async () => {
    await createRecipe({
      ...recipeInput,
      ingredients: [
        { ingredientId: "ing-oil", ingredientName: "olive oil", quantity: "2", unit: "Tablespoons", notes: "null", category: null },
        { ingredientId: "ing-onion", ingredientName: "onion", quantity: "1", unit: "large", notes: "diced", category: null },
        { ingredientId: "ing-tom", ingredientName: "diced tomatoes", quantity: "null", unit: "(15 ounce) can", notes: "", category: null },
      ],
    });

    expect(db.rpc).toHaveBeenCalledWith("save_recipe_ingredients", {
      p_recipe_id: "recipe-1",
      p_rows: [
        { ingredient_id: "ing-oil", ingredient_name: "olive oil", quantity: "2", quantity_numeric: 2, unit: "tbsp", notes: null },
        { ingredient_id: "ing-onion", ingredient_name: "onion", quantity: "1", quantity_numeric: 1, unit: null, notes: "large, diced" },
        { ingredient_id: "ing-tom", ingredient_name: "diced tomatoes", quantity: null, quantity_numeric: null, unit: "can", notes: "15 oz" },
      ],
    });
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
