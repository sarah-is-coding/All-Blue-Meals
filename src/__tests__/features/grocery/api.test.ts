import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildGroceryItemsForSavedPlan,
  buildGroceryItemsForRange,
} from "../../../features/grocery/api";

// ── Supabase mock ──────────────────────────────────────────────────────────

vi.mock("../../../lib/supabaseClient", () => {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};

  const chained = [
    "from", "select", "in",
    "order", "is",
  ];

  for (const method of chained) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }

  builder.returns      = vi.fn().mockResolvedValue({ data: [],  error: null });

  return { supabase: builder };
});

// Which meals count is decided by meal-plans (tested in meal-plans/api.test.ts);
// grocery generation only has to ask for the right saved plan/dates and use every meal.
vi.mock("../../../features/meal-plans/api", () => ({
  listPlannedMealsBetween: vi.fn(),
  listSavedPlanMeals: vi.fn(),
}));

import { supabase } from "../../../lib/supabaseClient";
import {
  listPlannedMealsBetween,
  listSavedPlanMeals,
} from "../../../features/meal-plans/api";
import type { PlannedMeal } from "../../../features/meal-plans/types";

const builder = supabase as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();

  // Re-wire chained methods after clearAllMocks
  const chained = [
    "from", "select", "in",
    "order", "is",
  ];
  for (const method of chained) {
    builder[method].mockReturnValue(builder);
  }

  builder.returns.mockResolvedValue({ data: [], error: null });
});

// ── Grocery generation ─────────────────────────────────────────────────────

/** A planned meal as meal-plans returns it. */
function meal(
  recipeId: string | null,
  { servings = 4, override = null }: { servings?: number | null; override?: number | null } = {}
): PlannedMeal {
  return {
    id: `meal-${recipeId}-${Math.random()}`,
    recipeId,
    recipeTitle: recipeId ?? "Untitled recipe",
    plannedFor: "2026-05-25",
    mealType: "dinner",
    servingsOverride: override,
    recipeServings: servings,
    effectiveServings: override ?? servings,
  };
}

const ingredientRow = (recipeId: string, name: string, quantity: string, unit = "", category: string | null = null) => ({
  recipe_id: recipeId,
  quantity,
  unit,
  // Step 8: the name comes from the catalog row, not recipe_ingredients.
  ingredients: { name, category },
});

beforeEach(() => {
  vi.mocked(listSavedPlanMeals).mockResolvedValue([]);
  vi.mocked(listPlannedMealsBetween).mockResolvedValue([]);
});

describe("buildGroceryItemsForSavedPlan", () => {
  it("uses the chosen plan's meals", async () => {
    await buildGroceryItemsForSavedPlan("plan-7");
    expect(listSavedPlanMeals).toHaveBeenCalledWith("plan-7");
    expect(listPlannedMealsBetween).not.toHaveBeenCalled();
  });

  it("returns an empty list when the plan has no meals, without querying ingredients", async () => {
    expect(await buildGroceryItemsForSavedPlan("plan-7")).toEqual([]);
    expect(builder.from).not.toHaveBeenCalledWith("recipe_ingredients");
  });

  it("returns an empty list when the plan's meals have no recipes (deleted recipes)", async () => {
    vi.mocked(listSavedPlanMeals).mockResolvedValue([meal(null)]);
    expect(await buildGroceryItemsForSavedPlan("plan-7")).toEqual([]);
  });

  it("fetches ingredients for every planned recipe, each once", async () => {
    vi.mocked(listSavedPlanMeals).mockResolvedValue([
      meal("r1"), meal("r2"), meal("r1"), meal(null), meal("r3"),
    ]);
    await buildGroceryItemsForSavedPlan("plan-7");
    expect(builder.from).toHaveBeenCalledWith("recipe_ingredients");
    expect(builder.in).toHaveBeenCalledWith("recipe_id", ["r1", "r2", "r3"]);
  });

  // Step 6 of docs/ingredient-normalization.md (replaces step 4's filter):
  // substitute rows are loaded too and shown as options on their main item,
  // never as items to buy; the item uses the catalog name.
  it("shows substitutes as options on their main item, scaled with the meal", async () => {
    vi.mocked(listSavedPlanMeals).mockResolvedValue([meal("r1", { servings: 2, override: 4 })]);
    builder.returns.mockResolvedValueOnce({
      data: [
        { id: "ri-1", recipe_id: "r1", ingredient_id: "i-olive", quantity: "1",
          unit: "tbsp", substitute_for: null, ingredients: { name: "olive oil", category: "baking" } },
        { id: "ri-2", recipe_id: "r1", ingredient_id: "i-avo", quantity: "1",
          unit: "tbsp", substitute_for: "ri-1", ingredients: { name: "avocado oil", category: "baking" } },
      ],
      error: null,
    });

    const items = await buildGroceryItemsForSavedPlan("plan-7");

    expect(builder.is).not.toHaveBeenCalled();
    expect(items).toEqual([
      { ingredientName: "olive oil", quantity: "2", unit: "tbsp", category: "baking", substitutes: ["avocado oil, 2 tbsp"] },
    ]);
  });

  it("includes every ingredient of every planned recipe, and nothing else", async () => {
    vi.mocked(listSavedPlanMeals).mockResolvedValue([meal("tacos"), meal("salad"), meal("toast")]);
    builder.returns.mockResolvedValueOnce({
      data: [
        ingredientRow("tacos", "tortillas", "8", "", "bakery_bread"),
        ingredientRow("tacos", "ground beef", "1", "lb", "meat_seafood"),
        ingredientRow("salad", "lettuce", "1", "head", "produce"),
        ingredientRow("salad", "olive oil", ""),
        // toast has no ingredients; a recipe that isn't planned must never appear:
        ingredientRow("not-planned", "anchovies", "1", "tin"),
      ],
      error: null,
    });

    const result = await buildGroceryItemsForSavedPlan("plan-7");

    expect(result.map((item) => item.ingredientName).sort()).toEqual(
      ["ground beef", "lettuce", "olive oil", "tortillas"]
    );
  });

  it("scales each meal's ingredients to the servings planned for it", async () => {
    vi.mocked(listSavedPlanMeals).mockResolvedValue([meal("r1", { servings: 4, override: 2 })]);
    builder.returns.mockResolvedValueOnce({
      data: [
        ingredientRow("r1", "flour", "2", "cup", "baking"),
        ingredientRow("r1", "eggs", "4", "", "dairy_eggs"),
      ],
      error: null,
    });

    // Sorted by category (dairy_eggs before pantry); scaled 2/4 = half.
    expect(await buildGroceryItemsForSavedPlan("plan-7")).toEqual([
      { ingredientName: "eggs", quantity: "2", unit: "", category: "dairy_eggs", substitutes: [] },
      { ingredientName: "flour", quantity: "1", unit: "cup", category: "baking", substitutes: [] },
    ]);
  });

  it("merges the same ingredient across meals, each scaled separately", async () => {
    vi.mocked(listSavedPlanMeals).mockResolvedValue([
      meal("r1", { servings: 4, override: 2 }),
      meal("r1", { servings: 4, override: 4 }),
    ]);
    builder.returns.mockResolvedValueOnce({
      data: [ingredientRow("r1", "butter", "4", "tbsp", "dairy_eggs")],
      error: null,
    });

    // 4 × 0.5 + 4 × 1 = 6
    expect(await buildGroceryItemsForSavedPlan("plan-7")).toEqual([
      { ingredientName: "butter", quantity: "6", unit: "tbsp", category: "dairy_eggs", substitutes: [] },
    ]);
  });

  it("throws when loading ingredients fails", async () => {
    vi.mocked(listSavedPlanMeals).mockResolvedValue([meal("r1")]);
    builder.returns.mockResolvedValueOnce({ data: null, error: { message: "DB error" } });
    await expect(buildGroceryItemsForSavedPlan("plan-7")).rejects.toThrow("DB error");
  });
});

describe("buildGroceryItemsForRange", () => {
  it("uses every meal planned in the range (what the planner shows for those days)", async () => {
    vi.mocked(listPlannedMealsBetween).mockResolvedValue([meal("r1")]);
    builder.returns.mockResolvedValueOnce({ data: [ingredientRow("r1", "rice", "1", "cup")], error: null });

    const result = await buildGroceryItemsForRange("2026-05-25", "2026-06-03");

    expect(listPlannedMealsBetween).toHaveBeenCalledWith("2026-05-25", "2026-06-03");
    expect(listSavedPlanMeals).not.toHaveBeenCalled();
    expect(result).toEqual([{ ingredientName: "rice", quantity: "1", unit: "cup", category: null, substitutes: [] }]);
  });

  it("doesn't look up any meal plan (dates decide which meals count)", async () => {
    await buildGroceryItemsForRange("2026-05-25", "2026-05-31");
    expect(builder.from).not.toHaveBeenCalledWith("meal_plans");
  });
});
