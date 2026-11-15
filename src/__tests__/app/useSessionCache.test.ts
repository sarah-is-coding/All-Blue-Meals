import { renderHook, waitFor } from "@testing-library/react";
import { useSessionCache } from "../../app/useSessionCache";
import { mealPlanKeys } from "../../features/meal-plans/queries";
import { groceryKeys } from "../../features/grocery/queries";
import { recipeKeys } from "../../features/recipes/queries";
import { getWeekStartIso, shiftWeekStartIso } from "../../lib/utils/dates";
import { saveMealPlannerViewState } from "../../features/meal-plans/utils/mealPlannerViewState";
import { createTestQueryClient } from "../utils/renderWithProviders";

vi.mock("../../features/meal-plans/api", () => ({
  listMealPlanItemsForWeek: vi.fn().mockResolvedValue([]),
}));

import { listMealPlanItemsForWeek } from "../../features/meal-plans/api";

const THIS_WEEK = getWeekStartIso(new Date());

const requestedWeeks = () =>
  vi.mocked(listMealPlanItemsForWeek).mock.calls.map(([week]) => week);

describe("useSessionCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
  });

  it("prefetches last, this, and next week's meal plan when a user signs in", async () => {
    const client = createTestQueryClient();
    const { rerender } = renderHook(({ userId }) => useSessionCache(userId, client), {
      initialProps: { userId: null as string | null },
    });
    expect(listMealPlanItemsForWeek).not.toHaveBeenCalled();

    rerender({ userId: "user-1" });

    await waitFor(() => expect(listMealPlanItemsForWeek).toHaveBeenCalledTimes(3));
    for (const week of [shiftWeekStartIso(THIS_WEEK, -1), THIS_WEEK, shiftWeekStartIso(THIS_WEEK, 1)]) {
      expect(listMealPlanItemsForWeek).toHaveBeenCalledWith(week);
      await waitFor(() =>
        expect(client.getQueryData(mealPlanKeys.week("user-1", week))).toEqual([])
      );
    }
  });

  it("loads the planner's week first, then the weeks either side", async () => {
    const client = createTestQueryClient();
    renderHook(() => useSessionCache("user-1", client));

    await waitFor(() => expect(listMealPlanItemsForWeek).toHaveBeenCalledTimes(3));
    expect(requestedWeeks()).toEqual([
      THIS_WEEK,
      shiftWeekStartIso(THIS_WEEK, -1),
      shiftWeekStartIso(THIS_WEEK, 1),
    ]);
  });

  it("prefetches around the week last viewed in this tab (e.g. after a reload)", async () => {
    saveMealPlannerViewState({ weekStartIso: "2026-01-05" });
    const client = createTestQueryClient();
    renderHook(() => useSessionCache("user-1", client));

    await waitFor(() => expect(listMealPlanItemsForWeek).toHaveBeenCalledTimes(3));
    expect(requestedWeeks()).toEqual(["2026-01-05", "2025-12-29", "2026-01-12"]);
  });

  it("prefetches when the app opens with a saved session", async () => {
    const client = createTestQueryClient();
    renderHook(() => useSessionCache("user-1", client));
    await waitFor(() => expect(listMealPlanItemsForWeek).toHaveBeenCalledTimes(3));
  });

  it("clears the whole cache when the user signs out", async () => {
    const client = createTestQueryClient();
    const { rerender } = renderHook(({ userId }) => useSessionCache(userId, client), {
      initialProps: { userId: "user-1" as string | null },
    });
    await waitFor(() =>
      expect(client.getQueryData(mealPlanKeys.week("user-1", THIS_WEEK))).toEqual([])
    );

    saveMealPlannerViewState({ weekStartIso: "2026-01-05" });
    rerender({ userId: null });

    expect(client.getQueryCache().getAll()).toHaveLength(0);
    // The planner's remembered week is cleared too, so the next person to sign
    // in on this tab starts on the current week.
    expect(window.sessionStorage.getItem("planmymeals:meal-plans:view-state")).toBeNull();
  });

  it("clears the previous user's data when a different user signs in", async () => {
    const client = createTestQueryClient();
    const { rerender } = renderHook(({ userId }) => useSessionCache(userId, client), {
      initialProps: { userId: "user-1" },
    });
    await waitFor(() =>
      expect(client.getQueryData(mealPlanKeys.week("user-1", THIS_WEEK))).toEqual([])
    );

    rerender({ userId: "user-2" });

    expect(client.getQueryData(mealPlanKeys.week("user-1", THIS_WEEK))).toBeUndefined();
    await waitFor(() =>
      expect(client.getQueryData(mealPlanKeys.week("user-2", THIS_WEEK))).toEqual([])
    );
  });

  it("sign-out wipes every feature's cached data: grocery lists, saved plans, and recipes", async () => {
    const client = createTestQueryClient();
    const { rerender } = renderHook(({ userId }) => useSessionCache(userId, client), {
      initialProps: { userId: "user-1" as string | null },
    });
    client.setQueryData(groceryKeys.savedLists("user-1"), [{ id: "list-1" }]);
    client.setQueryData(groceryKeys.list("user-1", "list-1"), { id: "list-1", items: [] });
    client.setQueryData(mealPlanKeys.savedList("user-1"), [{ id: "plan-1" }]);
    client.setQueryData(recipeKeys.detail("user-1", "r1"), { id: "r1" });
    client.setQueryData(
      recipeKeys.list("user-1", { searchTerm: "", filters: {} as never, page: 1, pageSize: 12 }),
      { recipes: [], totalCount: 0 }
    );

    rerender({ userId: null });

    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });
});
