import { act, waitFor } from "@testing-library/react";
import {
  mealPlanKeys,
  prefetchMealPlanWeeks,
  prefetchWeekThenNeighbours,
  useInvalidateMealPlanWeeks,
  useMealPlanActions,
  useMealPlanWeek,
} from "../../../features/meal-plans/queries";
import type { MealPlanItem } from "../../../features/meal-plans/types";
import {
  createTestQueryClient,
  renderHookWithProviders,
  TEST_USER_ID,
} from "../../utils/renderWithProviders";

vi.mock("../../../features/meal-plans/api", () => ({
  listMealPlanItemsForWeek: vi.fn(),
  addMealPlanItem: vi.fn(),
  deleteMealPlanItem: vi.fn(),
  moveMealPlanItem: vi.fn(),
  updateMealPlanItemServings: vi.fn(),
  clearWeekPlan: vi.fn(),
  applySavedMealPlan: vi.fn(),
}));

import {
  addMealPlanItem,
  applySavedMealPlan,
  clearWeekPlan,
  deleteMealPlanItem,
  listMealPlanItemsForWeek,
  moveMealPlanItem,
  updateMealPlanItemServings,
} from "../../../features/meal-plans/api";

const PREV = "2026-05-18";
const WEEK = "2026-05-25";
const NEXT = "2026-06-01";

const item = (id: string, plannedFor: string, extra: Partial<MealPlanItem> = {}): MealPlanItem => ({
  id,
  recipeId: `recipe-${id}`,
  recipeTitle: `Recipe ${id}`,
  plannedFor,
  mealType: "dinner",
  servingsOverride: null,
  recipeServings: 4,
  effectiveServings: 4,
  ...extra,
});

const cachedWeek = (client: ReturnType<typeof createTestQueryClient>, weekStartIso: string) =>
  client.getQueryData<MealPlanItem[]>(mealPlanKeys.week(TEST_USER_ID, weekStartIso));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listMealPlanItemsForWeek).mockImplementation(async (weekStartIso) =>
    weekStartIso === WEEK ? [item("a", WEEK)] : []
  );
});

describe("mealPlanKeys", () => {
  it("scopes every week key to the user", () => {
    expect(mealPlanKeys.week("user-1", WEEK)).toEqual(["meal-plans", "user-1", "week", WEEK]);
    expect(mealPlanKeys.week("user-1", WEEK)).not.toEqual(mealPlanKeys.week("user-2", WEEK));
  });
});

describe("prefetchMealPlanWeeks", () => {
  it("loads each week into the cache", async () => {
    const client = createTestQueryClient();
    await prefetchMealPlanWeeks(client, TEST_USER_ID, [PREV, WEEK, NEXT]);
    expect(listMealPlanItemsForWeek).toHaveBeenCalledTimes(3);
    expect(cachedWeek(client, WEEK)).toEqual([item("a", WEEK)]);
    expect(cachedWeek(client, PREV)).toEqual([]);
  });
});

describe("prefetchWeekThenNeighbours", () => {
  it("loads the week on its own first, and its neighbours only after it arrives", async () => {
    let releaseWeek!: () => void;
    vi.mocked(listMealPlanItemsForWeek).mockImplementation((weekStartIso) =>
      weekStartIso === WEEK
        ? new Promise((resolve) => {
            releaseWeek = () => resolve([item("a", WEEK)]);
          })
        : Promise.resolve([])
    );
    const client = createTestQueryClient();

    const done = prefetchWeekThenNeighbours(client, TEST_USER_ID, WEEK);
    await waitFor(() => expect(listMealPlanItemsForWeek).toHaveBeenCalledTimes(1));
    expect(listMealPlanItemsForWeek).toHaveBeenCalledWith(WEEK);

    releaseWeek();
    await done;
    expect(vi.mocked(listMealPlanItemsForWeek).mock.calls.map(([week]) => week)).toEqual([
      WEEK,
      PREV,
      NEXT,
    ]);
    expect(cachedWeek(client, NEXT)).toEqual([]);
  });

  it("does not load the neighbours if the week itself fails", async () => {
    vi.mocked(listMealPlanItemsForWeek).mockRejectedValue(new Error("offline"));
    const client = createTestQueryClient();

    await prefetchWeekThenNeighbours(client, TEST_USER_ID, WEEK);

    expect(listMealPlanItemsForWeek).toHaveBeenCalledTimes(1);
  });
});

describe("useMealPlanWeek", () => {
  it("loads the week and prefetches the weeks either side", async () => {
    const { result, client } = renderHookWithProviders(() => useMealPlanWeek(WEEK));
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.items).toEqual([item("a", WEEK)]));
    expect(result.current.loading).toBe(false);
    await waitFor(() => expect(cachedWeek(client, PREV)).toEqual([]));
    expect(cachedWeek(client, NEXT)).toEqual([]);
  });

  it("waits for the visible week before prefetching its neighbours", async () => {
    let releaseWeek!: () => void;
    vi.mocked(listMealPlanItemsForWeek).mockImplementation((weekStartIso) =>
      weekStartIso === WEEK
        ? new Promise((resolve) => {
            releaseWeek = () => resolve([item("a", WEEK)]);
          })
        : Promise.resolve([])
    );
    const { result } = renderHookWithProviders(() => useMealPlanWeek(WEEK));
    await waitFor(() => expect(listMealPlanItemsForWeek).toHaveBeenCalledWith(WEEK));
    expect(listMealPlanItemsForWeek).toHaveBeenCalledTimes(1);

    await act(async () => releaseWeek());
    await waitFor(() => expect(result.current.items).toEqual([item("a", WEEK)]));
    await waitFor(() => expect(listMealPlanItemsForWeek).toHaveBeenCalledTimes(3));
  });

  it("shows a week that is already cached immediately, without a loading state", async () => {
    const client = createTestQueryClient();
    await prefetchMealPlanWeeks(client, TEST_USER_ID, [WEEK]);

    const { result } = renderHookWithProviders(() => useMealPlanWeek(WEEK), { client });
    expect(result.current.loading).toBe(false);
    expect(result.current.items).toEqual([item("a", WEEK)]);
  });

  it("exposes the load error", async () => {
    vi.mocked(listMealPlanItemsForWeek).mockRejectedValue(new Error("Network down"));
    const { result } = renderHookWithProviders(() => useMealPlanWeek(WEEK));
    await waitFor(() => expect(result.current.error).toBe("Network down"));
  });

  it("does not load anything without a signed-in user", () => {
    renderHookWithProviders(() => useMealPlanWeek(WEEK), { userId: null });
    expect(listMealPlanItemsForWeek).not.toHaveBeenCalled();
  });
});

describe("useMealPlanActions", () => {
  async function setup() {
    const client = createTestQueryClient();
    await prefetchMealPlanWeeks(client, TEST_USER_ID, [WEEK, NEXT]);
    const { result } = renderHookWithProviders(() => useMealPlanActions(), { client });
    return { client, actions: result.current };
  }

  it("addItem saves, then adds the item to its week's cache", async () => {
    const { client, actions } = await setup();
    vi.mocked(addMealPlanItem).mockResolvedValue(item("new", "2026-06-03"));

    await act(() =>
      actions.addItem({
        weekStartIso: NEXT,
        plannedFor: "2026-06-03",
        mealType: "dinner",
        recipeId: "recipe-new",
        servingsOverride: null,
      })
    );

    expect(cachedWeek(client, NEXT)).toEqual([item("new", "2026-06-03")]);
    expect(cachedWeek(client, WEEK)).toEqual([item("a", WEEK)]);
  });

  it("removeItem deletes, then removes the item from the cache", async () => {
    const { client, actions } = await setup();
    vi.mocked(deleteMealPlanItem).mockResolvedValue(undefined);

    await act(() => actions.removeItem("a"));

    expect(deleteMealPlanItem).toHaveBeenCalledWith("a");
    expect(cachedWeek(client, WEEK)).toEqual([]);
  });

  it("moveItem updates the item in place within the same week", async () => {
    const { client, actions } = await setup();
    const moved = item("a", "2026-05-27", { mealType: "lunch" });
    vi.mocked(moveMealPlanItem).mockResolvedValue(moved);

    await act(() => actions.moveItem({ itemId: "a", plannedFor: "2026-05-27", mealType: "lunch" }));

    expect(cachedWeek(client, WEEK)).toEqual([moved]);
  });

  it("moveItem moves the item between cached weeks when it changes week", async () => {
    const { client, actions } = await setup();
    const moved = item("a", "2026-06-02");
    vi.mocked(moveMealPlanItem).mockResolvedValue(moved);

    await act(() => actions.moveItem({ itemId: "a", plannedFor: "2026-06-02", mealType: "dinner" }));

    expect(cachedWeek(client, WEEK)).toEqual([]);
    expect(cachedWeek(client, NEXT)).toEqual([moved]);
  });

  it("updateServings replaces the item in the cache", async () => {
    const { client, actions } = await setup();
    const updated = item("a", WEEK, { servingsOverride: 2, effectiveServings: 2 });
    vi.mocked(updateMealPlanItemServings).mockResolvedValue(updated);

    await act(() => actions.updateServings({ itemId: "a", servingsOverride: 2 }));

    expect(cachedWeek(client, WEEK)).toEqual([updated]);
  });

  it("applyPlan in replace mode clears the week, then adds items to each week they fall in", async () => {
    const { client, actions } = await setup();
    vi.mocked(clearWeekPlan).mockResolvedValue(undefined);
    vi.mocked(applySavedMealPlan).mockResolvedValue([
      item("p1", "2026-05-26"),
      item("p2", "2026-06-02"),
    ]);

    await act(() => actions.applyPlan("plan-1", WEEK, "replace"));

    expect(clearWeekPlan).toHaveBeenCalledWith(WEEK);
    expect(cachedWeek(client, WEEK)).toEqual([item("p1", "2026-05-26")]);
    expect(cachedWeek(client, NEXT)).toEqual([item("p2", "2026-06-02")]);
  });

  it("applyPlan in add mode keeps the week's existing items", async () => {
    const { client, actions } = await setup();
    vi.mocked(applySavedMealPlan).mockResolvedValue([item("p1", "2026-05-26")]);

    await act(() => actions.applyPlan("plan-1", WEEK, "add"));

    expect(clearWeekPlan).not.toHaveBeenCalled();
    expect(cachedWeek(client, WEEK)).toEqual([item("a", WEEK), item("p1", "2026-05-26")]);
  });

  it("leaves weeks that were never loaded alone", async () => {
    const { client, actions } = await setup();
    vi.mocked(addMealPlanItem).mockResolvedValue(item("far", "2026-09-01"));

    await act(() =>
      actions.addItem({
        weekStartIso: "2026-08-31",
        plannedFor: "2026-09-01",
        mealType: "dinner",
        recipeId: "recipe-far",
        servingsOverride: null,
      })
    );

    expect(cachedWeek(client, "2026-08-31")).toBeUndefined();
  });
});

describe("useMealPlanActions — requests already in flight", () => {
  /** The next request (for `week`) returns `data` only when released. */
  function holdNextRequest(week: string, data: MealPlanItem[]) {
    let release!: () => void;
    vi.mocked(listMealPlanItemsForWeek).mockImplementationOnce(async (requested) => {
      expect(requested).toBe(week);
      await new Promise<void>((resolve) => (release = resolve));
      return data;
    });
    return () => release();
  }

  it("a refresh that started before a change can't bring the old data back", async () => {
    const client = createTestQueryClient();
    await prefetchMealPlanWeeks(client, TEST_USER_ID, [WEEK]);
    const { result } = renderHookWithProviders(() => useMealPlanActions(), { client });
    vi.mocked(deleteMealPlanItem).mockResolvedValue(undefined);

    // A background refresh starts, reading the week while item "a" still exists...
    const releaseStaleRefresh = holdNextRequest(WEEK, [item("a", WEEK)]);
    void client.refetchQueries({ queryKey: mealPlanKeys.week(TEST_USER_ID, WEEK) });
    await waitFor(() => expect(listMealPlanItemsForWeek).toHaveBeenCalledTimes(2));

    // ...then "a" is removed, and only afterwards does the old refresh finish.
    await act(() => result.current.removeItem("a"));
    await act(async () => releaseStaleRefresh());

    expect(cachedWeek(client, WEEK)).toEqual([]);
  });

  it("a week still loading for the first time is reloaded so it includes the change", async () => {
    const client = createTestQueryClient();
    await prefetchMealPlanWeeks(client, TEST_USER_ID, [WEEK]);
    const { result } = renderHookWithProviders(() => useMealPlanActions(), { client });
    const moved = item("a", "2026-06-02");
    vi.mocked(moveMealPlanItem).mockResolvedValue(moved);

    // Next week starts loading (e.g. a neighbour prefetch) before the move is saved.
    const releaseStaleLoad = holdNextRequest(NEXT, []);
    void prefetchMealPlanWeeks(client, TEST_USER_ID, [NEXT]);
    await waitFor(() => expect(listMealPlanItemsForWeek).toHaveBeenCalledWith(NEXT));
    vi.mocked(listMealPlanItemsForWeek).mockResolvedValue([moved]);

    await act(() =>
      result.current.moveItem({ itemId: "a", plannedFor: "2026-06-02", mealType: "dinner" })
    );
    await act(async () => releaseStaleLoad());

    expect(cachedWeek(client, WEEK)).toEqual([]);
    await waitFor(() => expect(cachedWeek(client, NEXT)).toEqual([moved]));
  });
});

describe("useInvalidateMealPlanWeeks", () => {
  it("marks every cached week for the user as stale", async () => {
    const client = createTestQueryClient();
    await prefetchMealPlanWeeks(client, TEST_USER_ID, [WEEK, NEXT]);
    const { result } = renderHookWithProviders(() => useInvalidateMealPlanWeeks(), { client });

    await act(() => result.current());

    for (const week of [WEEK, NEXT]) {
      expect(client.getQueryState(mealPlanKeys.week(TEST_USER_ID, week))?.isInvalidated).toBe(true);
    }
  });
});
