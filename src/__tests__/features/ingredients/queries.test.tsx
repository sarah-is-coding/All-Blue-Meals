import { waitFor } from "@testing-library/react";
import { renderHookWithProviders } from "../../utils/renderWithProviders";
import { useIngredientCategories, useIngredientMatches } from "../../../features/ingredients/queries";
import { FALLBACK_CATEGORIES } from "../../../features/ingredients/categories/codes";

vi.mock("../../../features/ingredients/api", () => ({
  findIngredientMatches: vi.fn(),
}));

vi.mock("../../../features/ingredients/categories/api", () => ({
  listIngredientCategories: vi.fn(),
}));

import { findIngredientMatches } from "../../../features/ingredients/api";
import { listIngredientCategories } from "../../../features/ingredients/categories/api";

const onion = { id: "i-1", name: "onion", category: "produce" as const, defaultUnit: null };

describe("useIngredientMatches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findIngredientMatches).mockResolvedValue(new Map([["onion", onion]]));
  });

  it("reports matches by key and which names are new once loaded", async () => {
    const { result } = renderHookWithProviders(() => useIngredientMatches(["Onions", "sumac"]));

    // Nothing is "new" while the lookup is still running.
    expect(result.current.isNew("sumac")).toBe(false);

    await waitFor(() => expect(result.current.isNew("sumac")).toBe(true));
    expect(result.current.matchFor("onions")).toEqual(onion);
    expect(result.current.isNew("Onions")).toBe(false);
  });

  it("doesn't query when there are no names", () => {
    const { result } = renderHookWithProviders(() => useIngredientMatches([]));
    expect(findIngredientMatches).not.toHaveBeenCalled();
    expect(result.current.matchFor("onion")).toBeNull();
    expect(result.current.isNew("onion")).toBe(false);
  });
});

describe("useIngredientCategories", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the built-in list until the table loads, then the table's", async () => {
    const fromTable = [{ code: "produce" as const, name: "Fresh Produce", description: "Vegetables.", sortOrder: 1 }];
    vi.mocked(listIngredientCategories).mockResolvedValue(fromTable);

    const { result } = renderHookWithProviders(() => useIngredientCategories());

    expect(result.current).toBe(FALLBACK_CATEGORIES);
    await waitFor(() => expect(result.current).toEqual(fromTable));
  });

  it("keeps the built-in list when loading fails", async () => {
    vi.mocked(listIngredientCategories).mockRejectedValue(new Error("offline"));
    const { result } = renderHookWithProviders(() => useIngredientCategories());
    await waitFor(() => expect(listIngredientCategories).toHaveBeenCalled());
    expect(result.current).toBe(FALLBACK_CATEGORIES);
  });
});
