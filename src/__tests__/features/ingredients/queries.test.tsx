import { act, waitFor } from "@testing-library/react";
import { renderHookWithProviders, TEST_USER_ID } from "../../utils/renderWithProviders";
import {
  ingredientKeys,
  useCreateIngredient,
  useIngredientCategories,
  useIngredientMatches,
  useIngredientSearch,
} from "../../../features/ingredients/queries";
import { FALLBACK_CATEGORIES } from "../../../features/ingredients/categories/codes";
import type { Ingredient } from "../../../features/ingredients/types";

vi.mock("../../../features/ingredients/api", () => ({
  findIngredientMatches: vi.fn(),
  searchIngredients: vi.fn(),
  createIngredient: vi.fn(),
}));

vi.mock("../../../features/ingredients/categories/api", () => ({
  listIngredientCategories: vi.fn(),
}));

import { createIngredient, findIngredientMatches, searchIngredients } from "../../../features/ingredients/api";
import { listIngredientCategories } from "../../../features/ingredients/categories/api";

const onion = { id: "i-1", name: "onion", category: "produce" as const, defaultUnit: null };

describe("useIngredientSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(searchIngredients).mockResolvedValue([{ ...onion, matchedAlias: null }]);
  });

  it("searches the trimmed, lowercased term and passes the abort signal", async () => {
    const { result } = renderHookWithProviders(() => useIngredientSearch("  Onion "));

    await waitFor(() => expect(result.current.suggestions).toEqual([{ ...onion, matchedAlias: null }]));
    expect(searchIngredients).toHaveBeenCalledWith("onion", 8, { signal: expect.any(AbortSignal) });
  });

  it("searches nothing for an empty term", () => {
    const { result } = renderHookWithProviders(() => useIngredientSearch("   "));

    expect(searchIngredients).not.toHaveBeenCalled();
    expect(result.current).toEqual({ suggestions: [], loading: false });
  });

  it("shows no suggestions once the term is cleared, even with earlier results cached", async () => {
    const { result, rerender } = renderHookWithProviders((term: string) => useIngredientSearch(term), {
      initialProps: "onion",
    });
    await waitFor(() => expect(result.current.suggestions).toHaveLength(1));

    rerender("");
    expect(result.current.suggestions).toEqual([]);
  });
});

describe("useCreateIngredient", () => {
  beforeEach(() => vi.clearAllMocks());

  it("saves the ingredient and refreshes searches and 'is it new?' lookups", async () => {
    vi.mocked(createIngredient).mockResolvedValue(onion);
    const { result, client } = renderHookWithProviders(() => useCreateIngredient());
    const invalidate = vi.spyOn(client, "invalidateQueries");

    let created: Ingredient | undefined;
    await act(async () => {
      created = await result.current.create({ name: "onion", category: "produce" });
    });

    expect(created).toEqual(onion);
    expect(createIngredient).toHaveBeenCalledWith("onion", "produce");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ingredientKeys.searches(TEST_USER_ID) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ingredientKeys.allMatches(TEST_USER_ID) });
  });

  it("reports when saving fails, without refreshing anything", async () => {
    vi.mocked(createIngredient).mockRejectedValue(new Error("Couldn't save that ingredient. Try again."));
    const { result, client } = renderHookWithProviders(() => useCreateIngredient());
    const invalidate = vi.spyOn(client, "invalidateQueries");

    await act(async () => {
      await expect(result.current.create({ name: "onion", category: "produce" })).rejects.toThrow("Try again");
    });
    expect(invalidate).not.toHaveBeenCalled();
  });
});

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
