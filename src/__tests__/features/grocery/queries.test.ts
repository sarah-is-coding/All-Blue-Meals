import { act, waitFor } from "@testing-library/react";
import { renderHookWithProviders } from "../../utils/renderWithProviders";
import { useGroceryList } from "../../../features/grocery/queries";
import type { GroceryItemDraft, GrocerySource } from "../../../features/grocery/types";

vi.mock("../../../features/grocery/api", () => ({
  buildGroceryItemsForRange: vi.fn(),
  buildGroceryItemsForSavedPlan: vi.fn(),
}));

import { buildGroceryItemsForRange, buildGroceryItemsForSavedPlan } from "../../../features/grocery/api";

const item = (ingredientName: string): GroceryItemDraft => ({
  ingredientName,
  quantity: "1",
  unit: "",
  category: null,
  substitutes: [],
});

const WEEK: GrocerySource = { kind: "range", startIso: "2026-11-22", endIso: "2026-11-28" };
const PLAN: GrocerySource = {
  kind: "saved_plan",
  planId: "plan-1",
  planLabel: "Summer",
  startDate: "2026-06-01",
  endDate: "2026-06-07",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(buildGroceryItemsForRange).mockResolvedValue([item("onion")]);
  vi.mocked(buildGroceryItemsForSavedPlan).mockResolvedValue([item("rice")]);
});

describe("useGroceryList", () => {
  it("builds nothing until asked", () => {
    const { result } = renderHookWithProviders(() => useGroceryList());

    expect(result.current).toMatchObject({ source: null, items: null, building: false, error: null });
    expect(buildGroceryItemsForRange).not.toHaveBeenCalled();
  });

  it("builds a list for a date range", async () => {
    const { result } = renderHookWithProviders(() => useGroceryList());

    act(() => result.current.build(WEEK));
    expect(result.current.building).toBe(true);
    expect(result.current.items).toBeNull();

    await waitFor(() => expect(result.current.items).toEqual([item("onion")]));
    expect(buildGroceryItemsForRange).toHaveBeenCalledWith("2026-11-22", "2026-11-28");
    expect(result.current.source).toEqual(WEEK);
  });

  it("builds a list for a saved plan", async () => {
    const { result } = renderHookWithProviders(() => useGroceryList());

    act(() => result.current.build(PLAN));

    await waitFor(() => expect(result.current.items).toEqual([item("rice")]));
    expect(buildGroceryItemsForSavedPlan).toHaveBeenCalledWith("plan-1");
  });

  // Meals change on other pages, so building the same dates again must read
  // them fresh rather than reuse the cached list.
  it("reads the meals again when the same list is built again", async () => {
    const { result } = renderHookWithProviders(() => useGroceryList());
    act(() => result.current.build(WEEK));
    await waitFor(() => expect(result.current.items).toEqual([item("onion")]));
    const firstBuild = result.current.builtAt;

    vi.mocked(buildGroceryItemsForRange).mockResolvedValue([item("onion"), item("garlic")]);
    act(() => result.current.build({ ...WEEK }));

    await waitFor(() => expect(result.current.items).toEqual([item("onion"), item("garlic")]));
    expect(buildGroceryItemsForRange).toHaveBeenCalledTimes(2);
    expect(result.current.builtAt).not.toBe(firstBuild);
  });

  it("drops the list when cleared", async () => {
    const { result } = renderHookWithProviders(() => useGroceryList());
    act(() => result.current.build(WEEK));
    await waitFor(() => expect(result.current.items).not.toBeNull());

    act(() => result.current.clear());

    expect(result.current).toMatchObject({ source: null, items: null, error: null });
  });

  it("reports a build that fails", async () => {
    vi.mocked(buildGroceryItemsForRange).mockRejectedValue(new Error("Couldn't load your meals."));
    const { result } = renderHookWithProviders(() => useGroceryList());

    act(() => result.current.build(WEEK));

    await waitFor(() => expect(result.current.error).toBe("Couldn't load your meals."));
    expect(result.current.items).toBeNull();
  });
});
