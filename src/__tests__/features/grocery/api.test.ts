import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildGroceryItemsForSavedPlan,
  buildGroceryItemsForRange,
  deleteGroceryList,
  listSavedGroceryLists,
  renameGroceryList,
  saveGroceryList,
  toggleGroceryItem,
  uncheckAllGroceryItems,
} from "../../../features/grocery/api";

// ── Supabase mock ──────────────────────────────────────────────────────────

vi.mock("../../../lib/supabaseClient", () => {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};

  const chained = [
    "from", "select", "insert", "update", "delete", "eq", "in",
    "order", "limit", "not", "is", "maybeSingle",
  ];

  for (const method of chained) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }

  builder.single       = vi.fn().mockResolvedValue({ data: null, error: null });
  builder.maybeSingle  = vi.fn().mockResolvedValue({ data: null, error: null });
  builder.returns      = vi.fn().mockResolvedValue({ data: [],  error: null });

  // auth stub
  const auth = {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    }),
  };

  return { supabase: { ...builder, auth } };
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

const builder = supabase as unknown as Record<string, ReturnType<typeof vi.fn>> & {
  auth: { getUser: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();

  // Re-wire chained methods after clearAllMocks
  const chained = [
    "from", "select", "insert", "update", "delete", "eq", "in",
    "order", "limit", "not", "is", "maybeSingle",
  ];
  for (const method of chained) {
    builder[method].mockReturnValue(builder);
  }

  builder.single.mockResolvedValue({ data: null, error: null });
  builder.maybeSingle.mockResolvedValue({ data: null, error: null });
  builder.returns.mockResolvedValue({ data: [], error: null });
  builder.auth.getUser.mockResolvedValue({
    data: { user: { id: "user-1" } },
    error: null,
  });
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
          unit: "tbsp", substitute_for: null, ingredients: { name: "olive oil", category: "pantry" } },
        { id: "ri-2", recipe_id: "r1", ingredient_id: "i-avo", quantity: "1",
          unit: "tbsp", substitute_for: "ri-1", ingredients: { name: "avocado oil", category: "pantry" } },
      ],
      error: null,
    });

    const items = await buildGroceryItemsForSavedPlan("plan-7");

    expect(builder.is).not.toHaveBeenCalled();
    expect(items).toEqual([
      { ingredientName: "olive oil", quantity: "2", unit: "tbsp", category: "pantry", substitutes: ["avocado oil, 2 tbsp"] },
    ]);
  });

  it("includes every ingredient of every planned recipe, and nothing else", async () => {
    vi.mocked(listSavedPlanMeals).mockResolvedValue([meal("tacos"), meal("salad"), meal("toast")]);
    builder.returns.mockResolvedValueOnce({
      data: [
        ingredientRow("tacos", "tortillas", "8", "", "bakery & bread"),
        ingredientRow("tacos", "ground beef", "1", "lb", "meat & seafood"),
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
        ingredientRow("r1", "flour", "2", "cup", "pantry"),
        ingredientRow("r1", "eggs", "4", "", "dairy & eggs"),
      ],
      error: null,
    });

    // Sorted by category (dairy & eggs before pantry); scaled 2/4 = half.
    expect(await buildGroceryItemsForSavedPlan("plan-7")).toEqual([
      { ingredientName: "eggs", quantity: "2", unit: "", category: "dairy & eggs", substitutes: [] },
      { ingredientName: "flour", quantity: "1", unit: "cup", category: "pantry", substitutes: [] },
    ]);
  });

  it("merges the same ingredient across meals, each scaled separately", async () => {
    vi.mocked(listSavedPlanMeals).mockResolvedValue([
      meal("r1", { servings: 4, override: 2 }),
      meal("r1", { servings: 4, override: 4 }),
    ]);
    builder.returns.mockResolvedValueOnce({
      data: [ingredientRow("r1", "butter", "4", "tbsp", "dairy & eggs")],
      error: null,
    });

    // 4 × 0.5 + 4 × 1 = 6
    expect(await buildGroceryItemsForSavedPlan("plan-7")).toEqual([
      { ingredientName: "butter", quantity: "6", unit: "tbsp", category: "dairy & eggs", substitutes: [] },
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

// ── saveGroceryList ───────────────────────────────────────────────────────

describe("saveGroceryList", () => {
  it("inserts the list header and items, returns mapped GroceryList", async () => {
    const fakeListRow = {
      id: "list-1",
      title: "My List",
      saved_plan_id: "plan-1",
      start_date: null,
      end_date: null,
      created_at: "2026-05-25T00:00:00Z",
    };
    builder.single.mockResolvedValueOnce({ data: fakeListRow, error: null });

    const fakeItemRows = [
      { id: "item-1", ingredient_name: "salt", quantity: "1", unit: "tsp", is_checked: false, category: "pantry", substitutes: [] },
    ];
    builder.returns.mockResolvedValueOnce({ data: fakeItemRows, error: null });

    const result = await saveGroceryList("My List", { kind: "saved_plan", savedPlanId: "plan-1" }, [
      { ingredientName: "salt", quantity: "1", unit: "tsp", category: "pantry", substitutes: [] },
    ]);

    expect(result.id).toBe("list-1");
    expect(result.title).toBe("My List");
    expect(result.savedPlanId).toBe("plan-1");
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      ingredientName: "salt",
      quantity: "1",
      unit: "tsp",
      isChecked: false,
      category: "pantry",
    });
  });

  it("links the saved list to the chosen plan and writes every item to it", async () => {
    builder.single.mockResolvedValueOnce({
      data: { id: "list-9", title: "Groceries", saved_plan_id: "plan-7", created_at: "2026-05-25T00:00:00Z" },
      error: null,
    });
    builder.returns.mockResolvedValueOnce({ data: [], error: null });
    const drafts = [
      { ingredientName: "tortillas", quantity: "8", unit: "", category: "bakery & bread" as const, substitutes: [] },
      { ingredientName: "lettuce", quantity: "1", unit: "head", category: "produce" as const, substitutes: [] },
      { ingredientName: "olive oil", quantity: "", unit: "", category: null, substitutes: [] },
    ];

    await saveGroceryList("  Groceries  ", { kind: "saved_plan", savedPlanId: "plan-7" }, drafts);

    expect(builder.from).toHaveBeenCalledWith("grocery_lists");
    expect(builder.insert).toHaveBeenNthCalledWith(1, {
      user_id: "user-1",
      title: "Groceries",
      saved_plan_id: "plan-7",
      start_date: null,
      end_date: null,
    });
    expect(builder.from).toHaveBeenCalledWith("grocery_items");
    expect(builder.insert).toHaveBeenNthCalledWith(2, [
      { list_id: "list-9", ingredient_name: "tortillas", quantity: "8", unit: null, is_checked: false, category: "bakery & bread", substitutes: [] },
      { list_id: "list-9", ingredient_name: "lettuce", quantity: "1", unit: "head", is_checked: false, category: "produce", substitutes: [] },
      { list_id: "list-9", ingredient_name: "olive oil", quantity: null, unit: null, is_checked: false, category: null, substitutes: [] },
    ]);
  });

  it("saves a list built from dates with its range and no plan link", async () => {
    builder.single.mockResolvedValueOnce({
      data: {
        id: "list-3",
        title: "Groceries",
        saved_plan_id: null,
        start_date: "2026-05-25",
        end_date: "2026-06-03",
        created_at: "2026-05-25T00:00:00Z",
      },
      error: null,
    });
    builder.returns.mockResolvedValueOnce({ data: [], error: null });

    const result = await saveGroceryList(
      "Groceries",
      { kind: "range", startDate: "2026-05-25", endDate: "2026-06-03" },
      [{ ingredientName: "rice", quantity: "1", unit: "cup", category: null, substitutes: [] }]
    );

    expect(builder.insert).toHaveBeenNthCalledWith(1, {
      user_id: "user-1",
      title: "Groceries",
      saved_plan_id: null,
      start_date: "2026-05-25",
      end_date: "2026-06-03",
    });
    expect(result).toMatchObject({ startDate: "2026-05-25", endDate: "2026-06-03", savedPlanId: null });
  });

  it("returns empty items array when no items are passed", async () => {
    const fakeListRow = {
      id: "list-2",
      title: "Empty",
      saved_plan_id: null,
      created_at: "2026-05-25T00:00:00Z",
    };
    builder.single.mockResolvedValueOnce({ data: fakeListRow, error: null });

    const result = await saveGroceryList(
      "Empty",
      { kind: "range", startDate: "2026-05-25", endDate: "2026-05-31" },
      []
    );
    expect(result.items).toEqual([]);
  });

});

// ── listSavedGroceryLists ─────────────────────────────────────────────────

describe("listSavedGroceryLists", () => {
  it("maps rows to GroceryListSummary", async () => {
    builder.returns.mockResolvedValueOnce({
      data: [
        { id: "l1", title: "Week 1", saved_plan_id: "p1", start_date: null, end_date: null, created_at: "2026-01-01T00:00:00Z" },
        { id: "l2", title: "Week 2", saved_plan_id: null, start_date: "2026-01-05", end_date: "2026-01-11", created_at: "2026-01-08T00:00:00Z" },
      ],
      error: null,
    });

    const result = await listSavedGroceryLists();
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: "l1", title: "Week 1", savedPlanId: "p1" });
    expect(result[1]).toMatchObject({
      id: "l2",
      title: "Week 2",
      savedPlanId: null,
      startDate: "2026-01-05",
      endDate: "2026-01-11",
    });
  });

  it("returns empty array when no lists exist", async () => {
    builder.returns.mockResolvedValueOnce({ data: [], error: null });
    const result = await listSavedGroceryLists();
    expect(result).toEqual([]);
  });
});

// ── deleteGroceryList ─────────────────────────────────────────────────────

describe("deleteGroceryList", () => {
  it("calls delete with the correct id", async () => {
    builder.returns.mockResolvedValueOnce({ data: null, error: null });
    await deleteGroceryList("list-99");
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith("id", "list-99");
  });

  it("throws on error", async () => {
    builder.returns.mockResolvedValueOnce({ data: null, error: { message: "fail" } });
    await expect(deleteGroceryList("list-99")).rejects.toThrow("fail");
  });
});

// ── renameGroceryList ─────────────────────────────────────────────────────

describe("renameGroceryList", () => {
  it("updates the title and returns the updated summary", async () => {
    builder.single.mockResolvedValueOnce({
      data: {
        id: "list-1",
        title: "New Name",
        saved_plan_id: null,
        created_at: "2026-05-25T00:00:00Z",
      },
      error: null,
    });

    const result = await renameGroceryList("list-1", "New Name");
    expect(result.title).toBe("New Name");
    expect(builder.update).toHaveBeenCalledWith({ title: "New Name" });
  });
});

// ── toggleGroceryItem ─────────────────────────────────────────────────────

describe("toggleGroceryItem", () => {
  it("calls update with the correct is_checked value", async () => {
    builder.returns.mockResolvedValueOnce({ data: null, error: null });
    await toggleGroceryItem("item-1", true);
    expect(builder.update).toHaveBeenCalledWith({ is_checked: true });
    expect(builder.eq).toHaveBeenCalledWith("id", "item-1");
  });
});

// ── uncheckAllGroceryItems ────────────────────────────────────────────────

describe("uncheckAllGroceryItems", () => {
  it("updates is_checked to false for the whole list", async () => {
    builder.returns.mockResolvedValueOnce({ data: null, error: null });
    await uncheckAllGroceryItems("list-1");
    expect(builder.update).toHaveBeenCalledWith({ is_checked: false });
    expect(builder.eq).toHaveBeenCalledWith("list_id", "list-1");
  });
});
