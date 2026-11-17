import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────
// Supabase chainable mock
// ─────────────────────────────────────────────────────────────
vi.mock("../../../lib/supabaseClient", () => {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};

  const chained = [
    "from", "select", "update", "insert", "delete",
    "upsert", "eq", "not", "ilike", "in",
    "order", "limit", "gte", "lte",
  ];

  for (const method of chained) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }

  builder.returns     = vi.fn().mockResolvedValue({ data: [], error: null });
  builder.single      = vi.fn().mockResolvedValue({ data: null, error: null });
  builder.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

  const mockAuth = {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    }),
  };

  return { supabase: { ...builder, auth: mockAuth } };
});

import { supabase } from "../../../lib/supabaseClient";
import {
  addPlannedMeal,
  applySavedPlan,
  clearMealsBetween,
  copyMealsBetween,
  deleteSavedMealPlan,
  listPlannedMealsBetween,
  listPlannedMealsForWeek,
  listSavedMealPlans,
  listSavedPlanMeals,
  previewSavedMealPlan,
  renameSavedMealPlan,
  saveMealsAsPlan,
  searchSavedMealPlans,
} from "../../../features/meal-plans/api";

const db = supabase as unknown as Record<string, ReturnType<typeof vi.fn>>;

function resetChain() {
  const chained = [
    "from", "select", "update", "insert", "delete",
    "upsert", "eq", "not", "ilike", "in",
    "order", "limit", "gte", "lte",
  ];
  for (const fn of chained) {
    // mockReset() also flushes queued mockResolvedValueOnce values left over
    // from a previous describe (vi.clearAllMocks() only wipes call history).
    db[fn].mockReset();
    db[fn].mockReturnValue(db);
  }
  db.returns.mockReset();
  db.returns.mockResolvedValue({ data: [], error: null });
  db.single.mockReset();
  db.single.mockResolvedValue({ data: null, error: null });
  db.maybeSingle.mockReset();
  db.maybeSingle.mockResolvedValue({ data: null, error: null });
}

const SAVED_PLAN_COLUMNS = "id,name,source_start_date,source_end_date";

const itemRow = (id: string, plannedFor: string, title: string, mealType = "dinner") => ({
  id,
  recipe_id: `recipe-${id}`,
  planned_for: plannedFor,
  meal_type: mealType,
  servings_override: null,
  recipes: { title, servings: 4 },
});

/** A saved_plan_meals row as listSavedPlanMeals selects it. */
const savedMealRow = (id: string, dayOffset: number, title: string, mealType = "dinner") => ({
  id,
  day_offset: dayOffset,
  meal_type: mealType,
  recipe_id: `recipe-${id}`,
  servings_override: null,
  recipes: { title, servings: 4 },
});

const planRow = {
  id: "sp1",
  name: "Healthy Week",
  source_start_date: "2026-05-18",
  source_end_date: "2026-05-24",
};

// ─────────────────────────────────────────────────────────────
// Saved plans now live in their own tables (saved_plans /
// saved_plan_meals): frozen copies, separate from the calendar.
// ─────────────────────────────────────────────────────────────
describe("listSavedMealPlans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetChain();
  });

  it("queries the saved_plans table with the expected columns", async () => {
    await listSavedMealPlans();
    expect(db.from).toHaveBeenCalledWith("saved_plans");
    expect(db.select).toHaveBeenCalledWith(SAVED_PLAN_COLUMNS);
  });

  it("orders by created_at descending", async () => {
    await listSavedMealPlans();
    expect(db.order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("maps rows to SavedMealPlan objects", async () => {
    db.returns.mockResolvedValue({ data: [planRow], error: null });
    const result = await listSavedMealPlans();
    expect(result).toEqual([
      { id: "sp1", savedName: "Healthy Week", startDate: "2026-05-18", endDate: "2026-05-24" },
    ]);
  });

  it("returns an empty array when there are no saved plans", async () => {
    expect(await listSavedMealPlans()).toEqual([]);
  });

  it("throws when supabase returns an error", async () => {
    db.returns.mockResolvedValue({ data: null, error: { message: "DB error" } });
    await expect(listSavedMealPlans()).rejects.toThrow("DB error");
  });
});

describe("searchSavedMealPlans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetChain();
  });

  it("applies ilike on name when a query is provided", async () => {
    await searchSavedMealPlans("healthy");
    expect(db.from).toHaveBeenCalledWith("saved_plans");
    expect(db.ilike).toHaveBeenCalledWith("name", "%healthy%");
  });

  it("does not apply ilike when the query is empty", async () => {
    await searchSavedMealPlans("");
    expect(db.ilike).not.toHaveBeenCalled();
  });

  it("trims the query before applying ilike", async () => {
    await searchSavedMealPlans("  vegan  ");
    expect(db.ilike).toHaveBeenCalledWith("name", "%vegan%");
  });

  it("returns mapped results", async () => {
    db.returns.mockResolvedValue({ data: [planRow], error: null });
    const result = await searchSavedMealPlans("healthy");
    expect(result[0]).toMatchObject({ id: "sp1", savedName: "Healthy Week" });
  });

  it("throws when supabase returns an error", async () => {
    db.returns.mockResolvedValue({ data: null, error: { message: "Search error" } });
    await expect(searchSavedMealPlans("foo")).rejects.toThrow("Search error");
  });
});

describe("renameSavedMealPlan", () => {
  const renamedRow = { ...planRow, name: "New Name" };

  beforeEach(() => {
    vi.clearAllMocks();
    resetChain();
    db.single.mockResolvedValue({ data: renamedRow, error: null });
  });

  it("updates name on saved_plans, filtered by id", async () => {
    await renameSavedMealPlan("sp1", "New Name");
    expect(db.from).toHaveBeenCalledWith("saved_plans");
    expect(db.update).toHaveBeenCalledWith({ name: "New Name" });
    expect(db.eq).toHaveBeenCalledWith("id", "sp1");
  });

  it("trims the new name before saving", async () => {
    await renameSavedMealPlan("sp1", "  New Name  ");
    expect(db.update).toHaveBeenCalledWith({ name: "New Name" });
  });

  it("returns the updated SavedMealPlan", async () => {
    const result = await renameSavedMealPlan("sp1", "New Name");
    expect(result).toEqual({
      id: "sp1", savedName: "New Name", startDate: "2026-05-18", endDate: "2026-05-24",
    });
  });

  it("turns a unique-name violation into a friendly message", async () => {
    db.single.mockResolvedValue({
      data: null,
      error: { code: "23505", message: 'duplicate key value violates "saved_plans_user_id_name_key"' },
    });
    await expect(renameSavedMealPlan("sp1", "Taken")).rejects.toThrow(
      'You already have a saved plan called "Taken".'
    );
  });

  it("throws other errors as-is", async () => {
    db.single.mockResolvedValue({ data: null, error: { message: "Conflict" } });
    await expect(renameSavedMealPlan("sp1", "Taken")).rejects.toThrow("Conflict");
  });
});

describe("deleteSavedMealPlan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetChain();
    db.returns.mockResolvedValue({ data: null, error: null });
  });

  it("deletes from saved_plans only, filtered by id (calendar meals stay)", async () => {
    await deleteSavedMealPlan("sp1");
    expect(db.from).toHaveBeenCalledWith("saved_plans");
    expect(db.from).not.toHaveBeenCalledWith("planned_meals");
    expect(db.delete).toHaveBeenCalled();
    expect(db.eq).toHaveBeenCalledWith("id", "sp1");
  });

  it("resolves without throwing on success", async () => {
    await expect(deleteSavedMealPlan("sp1")).resolves.toBeUndefined();
  });

  it("throws when supabase returns an error", async () => {
    db.returns.mockResolvedValue({ data: null, error: { message: "Delete failed" } });
    await expect(deleteSavedMealPlan("sp1")).rejects.toThrow("Delete failed");
  });
});

// ─────────────────────────────────────────────────────────────
// saveMealsAsPlan: freeze the meals planned between two dates
// ─────────────────────────────────────────────────────────────
describe("saveMealsAsPlan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetChain();
    // 1st returns(): the planned meals being saved; 2nd: the saved_plan_meals insert.
    db.returns
      .mockResolvedValueOnce({
        data: [itemRow("i1", "2026-05-18", "Pasta"), itemRow("i2", "2026-05-20", "Soup")],
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: null });
    // single(): the inserted saved_plans row.
    db.single.mockResolvedValue({ data: planRow, error: null });
  });

  it("reads the meals with the shared date-range definition", async () => {
    await saveMealsAsPlan("Healthy Week", "2026-05-18", "2026-05-24");
    expect(db.from).toHaveBeenCalledWith("planned_meals");
    expect(db.gte).toHaveBeenCalledWith("planned_for", "2026-05-18");
    expect(db.lte).toHaveBeenCalledWith("planned_for", "2026-05-24");
    expect(db.in).toHaveBeenCalledWith("meal_type", ["breakfast", "lunch", "dinner"]);
  });

  it("inserts the plan with its trimmed name and source dates", async () => {
    await saveMealsAsPlan("  Healthy Week  ", "2026-05-18", "2026-05-24");
    expect(db.insert).toHaveBeenCalledWith({
      name: "Healthy Week",
      source_start_date: "2026-05-18",
      source_end_date: "2026-05-24",
    });
  });

  it("stores each meal as a day offset from the start date", async () => {
    await saveMealsAsPlan("Healthy Week", "2026-05-18", "2026-05-24");
    expect(db.from).toHaveBeenCalledWith("saved_plan_meals");
    expect(db.insert).toHaveBeenCalledWith([
      {
        saved_plan_id: "sp1",
        day_offset: 0,
        meal_type: "dinner",
        recipe_id: "recipe-i1",
        servings_override: null,
      },
      {
        saved_plan_id: "sp1",
        day_offset: 2,
        meal_type: "dinner",
        recipe_id: "recipe-i2",
        servings_override: null,
      },
    ]);
  });

  it("returns the mapped SavedMealPlan", async () => {
    const result = await saveMealsAsPlan("Healthy Week", "2026-05-18", "2026-05-24");
    expect(result).toEqual({
      id: "sp1", savedName: "Healthy Week", startDate: "2026-05-18", endDate: "2026-05-24",
    });
  });

  it("saves a plan with no meals (just the named range)", async () => {
    db.returns.mockReset();
    db.returns.mockResolvedValue({ data: [], error: null });
    const result = await saveMealsAsPlan("Empty Week", "2026-05-18", "2026-05-24");
    expect(result.id).toBe("sp1");
    expect(db.from).not.toHaveBeenCalledWith("saved_plan_meals");
  });

  it("turns a unique-name violation into a friendly message", async () => {
    db.single.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate key value" },
    });
    await expect(saveMealsAsPlan("Taken", "2026-05-18", "2026-05-24")).rejects.toThrow(
      'You already have a saved plan called "Taken".'
    );
  });

  it("deletes the plan row again when inserting its meals fails", async () => {
    db.returns.mockReset();
    db.returns
      .mockResolvedValueOnce({ data: [itemRow("i1", "2026-05-18", "Pasta")], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "Insert failed" } }) // meals insert
      .mockResolvedValueOnce({ data: null, error: null }); // cleanup delete
    await expect(saveMealsAsPlan("Healthy Week", "2026-05-18", "2026-05-24")).rejects.toThrow(
      "Insert failed"
    );
    expect(db.delete).toHaveBeenCalled();
    expect(db.eq).toHaveBeenCalledWith("id", "sp1");
  });
});

// ─────────────────────────────────────────────────────────────
// listSavedPlanMeals / previewSavedMealPlan
// ─────────────────────────────────────────────────────────────
describe("listSavedPlanMeals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetChain();
    db.single.mockResolvedValue({ data: planRow, error: null });
  });

  it("reads the plan and its meals from the saved tables", async () => {
    await listSavedPlanMeals("sp1");
    expect(db.from).toHaveBeenCalledWith("saved_plans");
    expect(db.from).toHaveBeenCalledWith("saved_plan_meals");
    expect(db.eq).toHaveBeenCalledWith("id", "sp1");
    expect(db.eq).toHaveBeenCalledWith("saved_plan_id", "sp1");
    expect(db.order).toHaveBeenCalledWith("day_offset", { ascending: true });
  });

  it("dates each meal from the plan's start date plus its day offset", async () => {
    db.returns.mockResolvedValue({
      data: [savedMealRow("m1", 0, "Pasta"), savedMealRow("m2", 3, "Soup", "lunch")],
      error: null,
    });
    const meals = await listSavedPlanMeals("sp1");
    expect(meals).toHaveLength(2);
    expect(meals[0]).toMatchObject({ id: "m1", plannedFor: "2026-05-18", recipeTitle: "Pasta" });
    expect(meals[1]).toMatchObject({ id: "m2", plannedFor: "2026-05-21", mealType: "lunch" });
  });

  it("throws when the plan can't be found", async () => {
    db.single.mockResolvedValue({ data: null, error: { message: "Not found" } });
    await expect(listSavedPlanMeals("sp1")).rejects.toThrow("Not found");
  });

  it("throws when loading the meals fails", async () => {
    db.returns.mockResolvedValue({ data: null, error: { message: "Load failed" } });
    await expect(listSavedPlanMeals("sp1")).rejects.toThrow("Load failed");
  });
});

describe("previewSavedMealPlan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetChain();
    db.single.mockResolvedValue({ data: planRow, error: null });
  });

  it("returns an empty array for a plan with no meals", async () => {
    expect(await previewSavedMealPlan("sp1")).toEqual([]);
  });

  it("groups recipe titles by the dates the offsets map to", async () => {
    db.returns.mockResolvedValue({
      data: [
        savedMealRow("m1", 0, "Pasta"),
        savedMealRow("m2", 0, "Salad", "lunch"),
        savedMealRow("m3", 1, "Soup"),
      ],
      error: null,
    });
    const result = await previewSavedMealPlan("sp1");
    expect(result).toEqual([
      { dateIso: "2026-05-18", recipes: ["Pasta", "Salad"] },
      { dateIso: "2026-05-19", recipes: ["Soup"] },
    ]);
  });
});

// ─────────────────────────────────────────────────────────────
// addPlannedMeal: one insert, no week plan (redesign step 2d)
// ─────────────────────────────────────────────────────────────
describe("addPlannedMeal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetChain();
    db.single.mockResolvedValue({ data: itemRow("i1", "2026-05-26", "Tacos"), error: null });
  });

  const input = {
    plannedFor: "2026-05-26",
    mealType: "dinner",
    recipeId: "recipe-i1",
    servingsOverride: null,
  } as const;

  it("inserts the meal by date, with no plan row looked up or created", async () => {
    await addPlannedMeal(input);
    expect(db.from).toHaveBeenCalledWith("planned_meals");
    expect(db.from).not.toHaveBeenCalledWith("meal_plans");
    expect(db.maybeSingle).not.toHaveBeenCalled();
    expect(db.insert).toHaveBeenCalledWith({
      recipe_id: "recipe-i1",
      planned_for: "2026-05-26",
      meal_type: "dinner",
      servings_override: null,
    });
  });

  it("returns the mapped meal", async () => {
    const item = await addPlannedMeal(input);
    expect(item).toMatchObject({ id: "i1", plannedFor: "2026-05-26", recipeTitle: "Tacos" });
  });

  it("throws when the insert fails", async () => {
    db.single.mockResolvedValue({ data: null, error: { message: "Insert failed" } });
    await expect(addPlannedMeal(input)).rejects.toThrow("Insert failed");
  });
});

// ─────────────────────────────────────────────────────────────
// Which meals count: the shared definitions
// ─────────────────────────────────────────────────────────────
describe("listPlannedMealsBetween", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetChain();
  });

  it("selects meals by date range and meal type, from any plan", async () => {
    await listPlannedMealsBetween("2026-05-25", "2026-06-07");
    expect(db.from).toHaveBeenCalledWith("planned_meals");
    expect(db.gte).toHaveBeenCalledWith("planned_for", "2026-05-25");
    expect(db.lte).toHaveBeenCalledWith("planned_for", "2026-06-07");
    expect(db.in).toHaveBeenCalledWith("meal_type", ["breakfast", "lunch", "dinner"]);
    // Dates decide what's in the range, not which plan a meal belongs to.
    expect(db.eq).not.toHaveBeenCalled();
  });

  it("maps rows to meal plan items", async () => {
    db.returns.mockResolvedValue({ data: [itemRow("i1", "2026-05-26", "Tacos")], error: null });
    const [item] = await listPlannedMealsBetween("2026-05-25", "2026-05-31");
    expect(item).toMatchObject({ id: "i1", plannedFor: "2026-05-26", recipeTitle: "Tacos", mealType: "dinner" });
  });

  it("throws when supabase returns an error", async () => {
    db.returns.mockResolvedValue({ data: null, error: { message: "Load failed" } });
    await expect(listPlannedMealsBetween("2026-05-25", "2026-05-31")).rejects.toThrow("Load failed");
  });
});

describe("listPlannedMealsForWeek", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetChain();
  });

  it("is the meals dated Monday to Sunday, without looking up the week's plan", async () => {
    await listPlannedMealsForWeek("2026-05-25");
    expect(db.gte).toHaveBeenCalledWith("planned_for", "2026-05-25");
    expect(db.lte).toHaveBeenCalledWith("planned_for", "2026-05-31");
    expect(db.maybeSingle).not.toHaveBeenCalled();
  });
});

describe("clearMealsBetween", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetChain();
  });

  it("deletes exactly the meals the planner shows for those dates", async () => {
    // The delete chain ends at .in(); make it resolve.
    db.in.mockResolvedValueOnce({ error: null });
    await clearMealsBetween("2026-05-25", "2026-06-03");
    expect(db.from).toHaveBeenCalledWith("planned_meals");
    expect(db.delete).toHaveBeenCalled();
    expect(db.gte).toHaveBeenCalledWith("planned_for", "2026-05-25");
    expect(db.lte).toHaveBeenCalledWith("planned_for", "2026-06-03");
    expect(db.in).toHaveBeenCalledWith("meal_type", ["breakfast", "lunch", "dinner"]);
  });

  it("throws when the delete fails", async () => {
    db.in.mockResolvedValueOnce({ error: { message: "Delete failed" } });
    await expect(clearMealsBetween("2026-05-25", "2026-05-31")).rejects.toThrow("Delete failed");
  });
});

// ─────────────────────────────────────────────────────────────
// copyMealsBetween: the past-weeks "Copy to current week"
// ─────────────────────────────────────────────────────────────
describe("copyMealsBetween", () => {
  const sourceItems = [
    itemRow("i1", "2026-05-18", "Pasta"),
    itemRow("i2", "2026-05-20", "Soup", "lunch"),
  ];
  const insertedItems = [
    itemRow("n1", "2026-05-25", "Pasta"),
    itemRow("n2", "2026-05-27", "Soup", "lunch"),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    resetChain();
    // 1st returns(): the source meals; 2nd: the inserted copies.
    db.returns
      .mockResolvedValueOnce({ data: sourceItems, error: null })
      .mockResolvedValueOnce({ data: insertedItems, error: null });
  });

  it("reads the source meals by dates, from any plan", async () => {
    await copyMealsBetween("2026-05-18", "2026-05-24", "2026-05-25", "add");
    expect(db.gte).toHaveBeenCalledWith("planned_for", "2026-05-18");
    expect(db.lte).toHaveBeenCalledWith("planned_for", "2026-05-24");
  });

  it("inserts copies shifted to the target start, with no plan to attach to", async () => {
    await copyMealsBetween("2026-05-18", "2026-05-24", "2026-05-25", "add");
    type ItemInsert = { planned_for: string; meal_plan_id?: string };
    const itemsCall = (db.insert.mock.calls as unknown[][]).find((args) =>
      Array.isArray(args[0])
    ) as [ItemInsert[]] | undefined;
    expect(itemsCall).toBeDefined();
    const inserts = itemsCall![0];
    expect(inserts.map((i) => i.planned_for)).toEqual(["2026-05-25", "2026-05-27"]);
    // Since step 2d the planner keeps no week plans: meals belong to the
    // user and their date alone.
    expect(inserts[0]).not.toHaveProperty("meal_plan_id");
    expect(db.from).not.toHaveBeenCalledWith("meal_plans");
  });

  it("returns the dates the copy covers and the new meals", async () => {
    const copied = await copyMealsBetween("2026-05-18", "2026-05-24", "2026-05-25", "add");
    expect(copied.startIso).toBe("2026-05-25");
    expect(copied.endIso).toBe("2026-05-31"); // same length as the source range
    expect(copied.items.map((i) => i.id)).toEqual(["n1", "n2"]);
  });

  it('"replace" clears the target dates before inserting, never the source', async () => {
    // .in() is chained once (reading the source), then awaited (the clear).
    db.in.mockReturnValueOnce(db).mockResolvedValueOnce({ error: null });
    await copyMealsBetween("2026-05-18", "2026-05-24", "2026-05-25", "replace");
    expect(db.delete).toHaveBeenCalled();
    // The clear targets the copy's landing dates.
    expect(db.gte).toHaveBeenCalledWith("planned_for", "2026-05-25");
    expect(db.lte).toHaveBeenCalledWith("planned_for", "2026-05-31");
  });

  it('"add" never deletes anything', async () => {
    await copyMealsBetween("2026-05-18", "2026-05-24", "2026-05-25", "add");
    expect(db.delete).not.toHaveBeenCalled();
  });

  it("copies nothing when the source range is empty, and still reports the target dates", async () => {
    db.returns.mockReset();
    db.returns.mockResolvedValue({ data: [], error: null });
    const copied = await copyMealsBetween("2026-05-18", "2026-05-24", "2026-05-25", "add");
    expect(copied).toEqual({ startIso: "2026-05-25", endIso: "2026-05-31", items: [] });
    expect(db.insert).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// applySavedPlan
// ─────────────────────────────────────────────────────────────
describe("applySavedPlan", () => {
  const insertedItems = [
    itemRow("n1", "2026-05-25", "Pasta"),
    itemRow("n2", "2026-05-28", "Soup", "lunch"),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    resetChain();
    // single(): the saved_plans row.
    db.single.mockResolvedValue({ data: planRow, error: null });
    // 1st returns(): the plan's saved meals; 2nd: the inserted copies.
    db.returns
      .mockResolvedValueOnce({
        data: [savedMealRow("m1", 0, "Pasta"), savedMealRow("m2", 3, "Soup", "lunch")],
        error: null,
      })
      .mockResolvedValueOnce({ data: insertedItems, error: null });
  });

  it("reads the plan's frozen meals from the saved tables, never week plans", async () => {
    await applySavedPlan("sp1", "2026-05-25", "add");
    expect(db.from).toHaveBeenCalledWith("saved_plans");
    expect(db.from).toHaveBeenCalledWith("saved_plan_meals");
    expect(db.eq).toHaveBeenCalledWith("saved_plan_id", "sp1");
    expect(db.from).not.toHaveBeenCalledWith("meal_plans");
  });

  it("inserts meals at the target start plus each day offset", async () => {
    await applySavedPlan("sp1", "2026-05-25", "add");
    type ItemInsert = { planned_for: string };
    const itemsCall = (db.insert.mock.calls as unknown[][]).find((args) =>
      Array.isArray(args[0])
    ) as [ItemInsert[]] | undefined;
    expect(itemsCall).toBeDefined();
    expect(itemsCall![0].map((i) => i.planned_for)).toEqual(["2026-05-25", "2026-05-28"]);
  });

  it("returns the dates covered (the plan's length) and every new meal", async () => {
    const copied = await applySavedPlan("sp1", "2026-05-25", "add");
    // The plan was saved from a 7-day range, so it covers 7 days at the target.
    expect(copied).toMatchObject({ startIso: "2026-05-25", endIso: "2026-05-31" });
    expect(copied.items).toHaveLength(2);
  });

  it('"replace" clears the plan\'s full length at the target before inserting', async () => {
    db.in.mockResolvedValueOnce({ error: null });
    await applySavedPlan("sp1", "2026-05-25", "replace");
    expect(db.delete).toHaveBeenCalled();
    expect(db.gte).toHaveBeenCalledWith("planned_for", "2026-05-25");
    expect(db.lte).toHaveBeenCalledWith("planned_for", "2026-05-31");
  });

  it("applies an empty plan as just a cleared/no-op range", async () => {
    db.returns.mockReset();
    db.returns.mockResolvedValue({ data: [], error: null });
    const copied = await applySavedPlan("sp1", "2026-05-25", "add");
    expect(copied.items).toEqual([]);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("throws when the saved plan can't be found", async () => {
    db.single.mockReset();
    db.single.mockResolvedValue({ data: null, error: { message: "Not found" } });
    await expect(applySavedPlan("sp1", "2026-05-25", "add")).rejects.toThrow("Not found");
  });
});
