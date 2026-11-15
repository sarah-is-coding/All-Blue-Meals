import { act, waitFor } from "@testing-library/react";
import {
  mealPlanKeys,
  useMealPlanSpans,
  useSavedMealPlanActions,
  useSavedMealPlanSearch,
  useSavedMealPlans,
  useSavedPlanPreview,
} from "../../../features/meal-plans/queries";
import type { SavedMealPlan } from "../../../features/meal-plans/types";
import {
  createTestQueryClient,
  renderHookWithProviders,
  TEST_USER_ID,
} from "../../utils/renderWithProviders";

vi.mock("../../../features/meal-plans/api", () => ({
  listMealPlanSpans: vi.fn(),
  listSavedMealPlans: vi.fn(),
  searchSavedMealPlans: vi.fn(),
  previewSavedMealPlan: vi.fn(),
  renameSavedMealPlan: vi.fn(),
  deleteSavedMealPlan: vi.fn(),
  savePlanById: vi.fn(),
}));

import {
  deleteSavedMealPlan,
  listMealPlanSpans,
  listSavedMealPlans,
  previewSavedMealPlan,
  renameSavedMealPlan,
  savePlanById,
  searchSavedMealPlans,
} from "../../../features/meal-plans/api";

const plan = (id: string, savedName: string): SavedMealPlan => ({
  id,
  savedName,
  startDate: "2026-05-25",
  endDate: "2026-05-31",
});

const isStale = (client: ReturnType<typeof createTestQueryClient>, key: readonly unknown[]) =>
  client.getQueryState(key)?.isInvalidated === true;

beforeEach(() => vi.clearAllMocks());

describe("meal-plan lookups", () => {
  it("useMealPlanSpans loads every plan's date range", async () => {
    vi.mocked(listMealPlanSpans).mockResolvedValue([
      { id: "p1", startDate: "2026-05-25", endDate: "2026-05-31" },
    ]);
    const { result } = renderHookWithProviders(() => useMealPlanSpans());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.spans).toHaveLength(1));
    expect(result.current.loading).toBe(false);
  });

  it("useSavedMealPlans loads the saved plans and reports errors", async () => {
    vi.mocked(listSavedMealPlans).mockRejectedValue(new Error("Network down"));
    const { result } = renderHookWithProviders(() => useSavedMealPlans());
    await waitFor(() => expect(result.current.error).toBe("Network down"));
    expect(result.current.plans).toEqual([]);
  });

  it("useSavedMealPlanSearch caches results per search term", async () => {
    vi.mocked(searchSavedMealPlans).mockImplementation(async (term) =>
      term === "lean" ? [plan("p1", "Lean week")] : []
    );
    const { result, rerender } = renderHookWithProviders(
      ({ term }: { term: string }) => useSavedMealPlanSearch(term),
      { initialProps: { term: "lean" } }
    );
    await waitFor(() => expect(result.current.results).toEqual([plan("p1", "Lean week")]));

    rerender({ term: "xyz" });
    await waitFor(() => expect(result.current.results).toEqual([]));
    rerender({ term: "lean" });
    expect(result.current.results).toEqual([plan("p1", "Lean week")]);
    expect(searchSavedMealPlans).toHaveBeenCalledTimes(2);
  });

  it("useSavedPlanPreview loads nothing until a plan is chosen", async () => {
    vi.mocked(previewSavedMealPlan).mockResolvedValue([{ dateIso: "2026-05-25", recipes: ["Tacos"] }]);
    const { result, rerender } = renderHookWithProviders(
      ({ planId }: { planId: string | null }) => useSavedPlanPreview(planId),
      { initialProps: { planId: null as string | null } }
    );
    expect(result.current).toMatchObject({ preview: [], loading: false });
    expect(previewSavedMealPlan).not.toHaveBeenCalled();

    rerender({ planId: "p1" });
    await waitFor(() => expect(result.current.preview).toHaveLength(1));
    expect(previewSavedMealPlan).toHaveBeenCalledWith("p1");
  });
});

describe("useSavedMealPlanActions", () => {
  async function setup() {
    const client = createTestQueryClient();
    client.setQueryData(mealPlanKeys.savedList(TEST_USER_ID), [plan("p1", "Lean week"), plan("p2", "Party")]);
    client.setQueryData(mealPlanKeys.savedSearch(TEST_USER_ID, "lean"), [plan("p1", "Lean week")]);
    client.setQueryData(mealPlanKeys.week(TEST_USER_ID, "2026-05-25"), []);
    client.setQueryData(mealPlanKeys.spans(TEST_USER_ID), []);
    const { result } = renderHookWithProviders(() => useSavedMealPlanActions(), { client });
    return { client, actions: result.current };
  }

  it("rename updates the saved list and refreshes searches", async () => {
    const { client, actions } = await setup();
    vi.mocked(renameSavedMealPlan).mockResolvedValue(plan("p1", "Lighter week"));

    await act(() => actions.rename("p1", "Lighter week"));

    expect(client.getQueryData(mealPlanKeys.savedList(TEST_USER_ID))).toEqual([
      plan("p1", "Lighter week"),
      plan("p2", "Party"),
    ]);
    expect(isStale(client, mealPlanKeys.savedSearch(TEST_USER_ID, "lean"))).toBe(true);
    // The list was just updated precisely, so it isn't refetched.
    expect(isStale(client, mealPlanKeys.savedList(TEST_USER_ID))).toBe(false);
  });

  it("remove deletes the plan and refreshes everything that could show its meals", async () => {
    const { client, actions } = await setup();
    vi.mocked(deleteSavedMealPlan).mockResolvedValue(undefined);

    await act(() => actions.remove("p1"));

    expect(client.getQueryData(mealPlanKeys.savedList(TEST_USER_ID))).toEqual([plan("p2", "Party")]);
    expect(isStale(client, mealPlanKeys.week(TEST_USER_ID, "2026-05-25"))).toBe(true);
    expect(isStale(client, mealPlanKeys.spans(TEST_USER_ID))).toBe(true);
    expect(isStale(client, mealPlanKeys.savedSearch(TEST_USER_ID, "lean"))).toBe(true);
  });

  it("saveAs names a plan and refreshes saved-plan lists", async () => {
    const { client, actions } = await setup();
    vi.mocked(savePlanById).mockResolvedValue(plan("p3", "New template"));

    const saved = await act(() => actions.saveAs("p3", "New template"));

    expect(saved).toEqual(plan("p3", "New template"));
    expect(isStale(client, mealPlanKeys.savedList(TEST_USER_ID))).toBe(true);
    expect(isStale(client, mealPlanKeys.savedSearch(TEST_USER_ID, "lean"))).toBe(true);
  });

describe("useSavedMealPlanActions — coverage of related cached data", () => {
  it("rename and delete refresh every cached search term, including the empty search", async () => {
    const client = createTestQueryClient();
    const terms = ["", "lean", "week"];
    for (const term of terms) {
      client.setQueryData(mealPlanKeys.savedSearch(TEST_USER_ID, term), [plan("p1", "Lean week")]);
    }
    vi.mocked(renameSavedMealPlan).mockResolvedValue(plan("p1", "Lighter week"));
    vi.mocked(deleteSavedMealPlan).mockResolvedValue(undefined);
    const { result } = renderHookWithProviders(() => useSavedMealPlanActions(), { client });
    const allStale = () =>
      terms.every(
        (term) => client.getQueryState(mealPlanKeys.savedSearch(TEST_USER_ID, term))?.isInvalidated
      );

    await act(() => result.current.rename("p1", "Lighter week"));
    expect(allStale()).toBe(true);

    for (const term of terms) {
      client.setQueryData(mealPlanKeys.savedSearch(TEST_USER_ID, term), []);
    }
    await act(() => result.current.remove("p1"));
    expect(allStale()).toBe(true);
  });
});
});
