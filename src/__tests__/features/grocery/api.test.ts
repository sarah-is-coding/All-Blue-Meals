import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildGroceryItemsForPlan,
  buildGroceryItemsForWeek,
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
    "order", "limit", "not", "maybeSingle",
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
// grocery generation only has to ask for the right plan/dates and use every meal.
vi.mock("../../../features/meal-plans/api", () => ({
  listMealPlanItemsBetween: vi.fn(),
  listMealPlanItemsForPlan: vi.fn(),
}));

import { supabase } from "../../../lib/supabaseClient";
import {
  listMealPlanItemsBetween,
  listMealPlanItemsForPlan,
} from "../../../features/meal-plans/api";
import type { MealPlanItem } from "../../../features/meal-plans/types";

const builder = supabase as unknown as Record<string, ReturnType<typeof vi.fn>> & {
  auth: { getUser: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();

  // Re-wire chained methods after clearAllMocks
  const chained = [
    "from", "select", "insert", "update", "delete", "eq", "in",
    "order", "limit", "not", "maybeSingle",
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
): MealPlanItem {
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
  ingredient_name: name,
  quantity,
  unit,
  ingredients: category ? { category } : null,
});

beforeEach(() => {
  vi.mocked(listMealPlanItemsForPlan).mockResolvedValue([]);
  vi.mocked(listMealPlanItemsBetween).mockResolvedValue([]);
});

describe("buildGroceryItemsForPlan", () => {
  it("uses the chosen plan's meals", async () => {
    await buildGroceryItemsForPlan("plan-7");
    expect(listMealPlanItemsForPlan).toHaveBeenCalledWith("plan-7");
    expect(listMealPlanItemsBetween).not.toHaveBeenCalled();
  });

  it("returns an empty list when the plan has no meals, without querying ingredients", async () => {
    expect(await buildGroceryItemsForPlan("plan-7")).toEqual([]);
    expect(builder.from).not.toHaveBeenCalledWith("recipe_ingredients");
  });

  it("returns an empty list when the plan's meals have no recipes (deleted recipes)", async () => {
    vi.mocked(listMealPlanItemsForPlan).mockResolvedValue([meal(null)]);
    expect(await buildGroceryItemsForPlan("plan-7")).toEqual([]);
  });

  it("fetches ingredients for every planned recipe, each once", async () => {
    vi.mocked(listMealPlanItemsForPlan).mockResolvedValue([
      meal("r1"), meal("r2"), meal("r1"), meal(null), meal("r3"),
    ]);
    await buildGroceryItemsForPlan("plan-7");
    expect(builder.from).toHaveBeenCalledWith("recipe_ingredients");
    expect(builder.in).toHaveBeenCalledWith("recipe_id", ["r1", "r2", "r3"]);
  });

  it("includes every ingredient of every planned recipe, and nothing else", async () => {
    vi.mocked(listMealPlanItemsForPlan).mockResolvedValue([meal("tacos"), meal("salad"), meal("toast")]);
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

    const result = await buildGroceryItemsForPlan("plan-7");

    expect(result.map((item) => item.ingredientName).sort()).toEqual(
      ["ground beef", "lettuce", "olive oil", "tortillas"]
    );
  });

  it("scales each meal's ingredients to the servings planned for it", async () => {
    vi.mocked(listMealPlanItemsForPlan).mockResolvedValue([meal("r1", { servings: 4, override: 2 })]);
    builder.returns.mockResolvedValueOnce({
      data: [
        ingredientRow("r1", "flour", "2", "cup", "pantry"),
        ingredientRow("r1", "eggs", "4", "", "dairy & eggs"),
      ],
      error: null,
    });

    // Sorted by category (dairy & eggs before pantry); scaled 2/4 = half.
    expect(await buildGroceryItemsForPlan("plan-7")).toEqual([
      { ingredientName: "eggs", quantity: "2", unit: "", category: "dairy & eggs" },
      { ingredientName: "flour", quantity: "1", unit: "cup", category: "pantry" },
    ]);
  });

  it("merges the same ingredient across meals, each scaled separately", async () => {
    vi.mocked(listMealPlanItemsForPlan).mockResolvedValue([
      meal("r1", { servings: 4, override: 2 }),
      meal("r1", { servings: 4, override: 4 }),
    ]);
    builder.returns.mockResolvedValueOnce({
      data: [ingredientRow("r1", "butter", "4", "tbsp", "dairy & eggs")],
      error: null,
    });

    // 4 × 0.5 + 4 × 1 = 6
    expect(await buildGroceryItemsForPlan("plan-7")).toEqual([
      { ingredientName: "butter", quantity: "6", unit: "tbsp", category: "dairy & eggs" },
    ]);
  });

  it("throws when loading ingredients fails", async () => {
    vi.mocked(listMealPlanItemsForPlan).mockResolvedValue([meal("r1")]);
    builder.returns.mockResolvedValueOnce({ data: null, error: { message: "DB error" } });
    await expect(buildGroceryItemsForPlan("plan-7")).rejects.toThrow("DB error");
  });
});

describe("buildGroceryItemsForWeek", () => {
  it("uses every meal planned in that week (what the planner shows), Monday to Sunday", async () => {
    vi.mocked(listMealPlanItemsBetween).mockResolvedValue([meal("r1")]);
    builder.returns.mockResolvedValueOnce({ data: [ingredientRow("r1", "rice", "1", "cup")], error: null });

    const result = await buildGroceryItemsForWeek("2026-05-25");

    expect(listMealPlanItemsBetween).toHaveBeenCalledWith("2026-05-25", "2026-05-31");
    expect(result.items.map((item) => item.ingredientName)).toEqual(["rice"]);
  });

  it("returns the week's plan id so the saved list links back to it", async () => {
    builder.maybeSingle.mockResolvedValueOnce({ data: { id: "plan-42" }, error: null });

    const result = await buildGroceryItemsForWeek("2026-05-25");

    expect(builder.eq).toHaveBeenCalledWith("start_date", "2026-05-25");
    expect(result.planId).toBe("plan-42");
  });

  it("still builds the list when no plan starts that week (e.g. a longer plan covers it)", async () => {
    builder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    vi.mocked(listMealPlanItemsBetween).mockResolvedValue([meal("r1")]);
    builder.returns.mockResolvedValueOnce({ data: [ingredientRow("r1", "rice", "1", "cup")], error: null });

    const result = await buildGroceryItemsForWeek("2026-05-25");

    expect(result).toEqual({
      items: [{ ingredientName: "rice", quantity: "1", unit: "cup", category: null }],
      planId: null,
    });
  });
});

// ── saveGroceryList ───────────────────────────────────────────────────────

describe("saveGroceryList", () => {
  it("inserts the list header and items, returns mapped GroceryList", async () => {
    const fakeListRow = {
      id: "list-1",
      title: "My List",
      meal_plan_id: "plan-1",
      created_at: "2026-05-25T00:00:00Z",
    };
    builder.single.mockResolvedValueOnce({ data: fakeListRow, error: null });

    const fakeItemRows = [
      { id: "item-1", ingredient_name: "salt", quantity: "1", unit: "tsp", is_checked: false, category: "pantry" },
    ];
    builder.returns.mockResolvedValueOnce({ data: fakeItemRows, error: null });

    const result = await saveGroceryList("My List", "plan-1", [
      { ingredientName: "salt", quantity: "1", unit: "tsp", category: "pantry" },
    ]);

    expect(result.id).toBe("list-1");
    expect(result.title).toBe("My List");
    expect(result.mealPlanId).toBe("plan-1");
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
      data: { id: "list-9", title: "Groceries", meal_plan_id: "plan-7", created_at: "2026-05-25T00:00:00Z" },
      error: null,
    });
    builder.returns.mockResolvedValueOnce({ data: [], error: null });
    const drafts = [
      { ingredientName: "tortillas", quantity: "8", unit: "", category: "bakery & bread" as const },
      { ingredientName: "lettuce", quantity: "1", unit: "head", category: "produce" as const },
      { ingredientName: "olive oil", quantity: "", unit: "", category: null },
    ];

    await saveGroceryList("  Groceries  ", "plan-7", drafts);

    expect(builder.from).toHaveBeenCalledWith("grocery_lists");
    expect(builder.insert).toHaveBeenNthCalledWith(1, {
      user_id: "user-1",
      title: "Groceries",
      meal_plan_id: "plan-7",
    });
    expect(builder.from).toHaveBeenCalledWith("grocery_items");
    expect(builder.insert).toHaveBeenNthCalledWith(2, [
      { list_id: "list-9", ingredient_name: "tortillas", quantity: "8", unit: null, is_checked: false, category: "bakery & bread" },
      { list_id: "list-9", ingredient_name: "lettuce", quantity: "1", unit: "head", is_checked: false, category: "produce" },
      { list_id: "list-9", ingredient_name: "olive oil", quantity: null, unit: null, is_checked: false, category: null },
    ]);
  });

  it("returns empty items array when no items are passed", async () => {
    const fakeListRow = {
      id: "list-2",
      title: "Empty",
      meal_plan_id: null,
      created_at: "2026-05-25T00:00:00Z",
    };
    builder.single.mockResolvedValueOnce({ data: fakeListRow, error: null });

    const result = await saveGroceryList("Empty", null, []);
    expect(result.items).toEqual([]);
  });

});

// ── listSavedGroceryLists ─────────────────────────────────────────────────

describe("listSavedGroceryLists", () => {
  it("maps rows to GroceryListSummary", async () => {
    builder.returns.mockResolvedValueOnce({
      data: [
        { id: "l1", title: "Week 1", meal_plan_id: "p1", created_at: "2026-01-01T00:00:00Z" },
        { id: "l2", title: "Week 2", meal_plan_id: null, created_at: "2026-01-08T00:00:00Z" },
      ],
      error: null,
    });

    const result = await listSavedGroceryLists();
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: "l1", title: "Week 1", mealPlanId: "p1" });
    expect(result[1]).toMatchObject({ id: "l2", title: "Week 2", mealPlanId: null });
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
        meal_plan_id: null,
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
