import {
  listIngredientCategories,
  upgradeIngredientCategory,
} from "../../../../features/ingredients/categories/api";

vi.mock("../../../../lib/supabaseClient", () => {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ["from", "select", "order"]) builder[method] = vi.fn().mockReturnValue(builder);
  builder.returns = vi.fn().mockResolvedValue({ data: [], error: null });
  builder.rpc = vi.fn().mockResolvedValue({ data: null, error: null });
  return { supabase: builder };
});

import { supabase } from "../../../../lib/supabaseClient";

const db = supabase as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
  for (const method of ["from", "select", "order"]) db[method].mockReturnValue(db);
  db.returns.mockResolvedValue({ data: [], error: null });
  db.rpc.mockResolvedValue({ data: null, error: null });
});

describe("listIngredientCategories", () => {
  it("reads the table in store order and maps the rows", async () => {
    db.returns.mockResolvedValueOnce({
      data: [
        { id: "produce", name: "Produce", description: "Fresh vegetables.", sort_order: 1 },
        { id: "meat_seafood", name: "Meat & Seafood", description: "Meat and fish.", sort_order: 2 },
      ],
      error: null,
    });

    const categories = await listIngredientCategories();

    expect(db.from).toHaveBeenCalledWith("ingredient_categories");
    expect(db.select).toHaveBeenCalledWith("id,name,description,sort_order");
    expect(db.order).toHaveBeenCalledWith("sort_order", { ascending: true });
    expect(categories).toEqual([
      { code: "produce", name: "Produce", description: "Fresh vegetables.", sortOrder: 1 },
      { code: "meat_seafood", name: "Meat & Seafood", description: "Meat and fish.", sortOrder: 2 },
    ]);
  });

  it("skips a row whose code the app doesn't know", async () => {
    db.returns.mockResolvedValueOnce({
      data: [{ id: "household", name: "Household", description: "", sort_order: 15 }],
      error: null,
    });
    expect(await listIngredientCategories()).toEqual([]);
  });

  it("throws on an error", async () => {
    db.returns.mockResolvedValueOnce({ data: null, error: { message: "nope" } });
    await expect(listIngredientCategories()).rejects.toThrow("nope");
  });
});

describe("upgradeIngredientCategory", () => {
  it("calls the database function and reports success", async () => {
    expect(await upgradeIngredientCategory("i-1", "produce")).toBe(true);
    expect(db.rpc).toHaveBeenCalledWith("upgrade_ingredient_category", {
      p_ingredient_id: "i-1",
      p_category: "produce",
    });
  });

  it("returns false instead of throwing when it fails", async () => {
    db.rpc.mockResolvedValueOnce({ data: null, error: { message: "denied" } });
    expect(await upgradeIngredientCategory("i-1", "produce")).toBe(false);
    db.rpc.mockRejectedValueOnce(new Error("offline"));
    expect(await upgradeIngredientCategory("i-1", "produce")).toBe(false);
  });
});
