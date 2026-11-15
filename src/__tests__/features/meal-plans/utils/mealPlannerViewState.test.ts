import {
  clearMealPlannerViewState,
  getPlannerStartWeek,
  loadMealPlannerViewState,
  saveMealPlannerViewState,
} from "../../../../features/meal-plans/utils/mealPlannerViewState";

const STORAGE_KEY = "planmymeals:meal-plans:view-state";
// Wednesday 2026-05-27 → its week starts Monday 2026-05-25
const WEDNESDAY = new Date(2026, 4, 27);

describe("mealPlannerViewState", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("round-trips the saved week", () => {
    saveMealPlannerViewState({ weekStartIso: "2026-06-01" });
    expect(loadMealPlannerViewState({ weekStartIso: "2026-05-25" })).toEqual({
      weekStartIso: "2026-06-01",
    });
  });

  it("falls back when nothing is saved or the saved value is invalid", () => {
    const fallback = { weekStartIso: "2026-05-25" };
    expect(loadMealPlannerViewState(fallback)).toEqual(fallback);

    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ weekStartIso: "next tuesday" }));
    expect(loadMealPlannerViewState(fallback)).toEqual(fallback);

    window.sessionStorage.setItem(STORAGE_KEY, "{not json");
    expect(loadMealPlannerViewState(fallback)).toEqual(fallback);
  });

  it("clearMealPlannerViewState forgets the saved week", () => {
    saveMealPlannerViewState({ weekStartIso: "2026-06-01" });
    clearMealPlannerViewState();
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe("getPlannerStartWeek", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("is the current week when no week has been viewed in this tab", () => {
    expect(getPlannerStartWeek(WEDNESDAY)).toBe("2026-05-25");
  });

  it("is the last week viewed in this tab when there is one", () => {
    saveMealPlannerViewState({ weekStartIso: "2026-06-15" });
    expect(getPlannerStartWeek(WEDNESDAY)).toBe("2026-06-15");
  });

  it("rounds a saved non-Monday date to its week's Monday", () => {
    saveMealPlannerViewState({ weekStartIso: "2026-06-17" });
    expect(getPlannerStartWeek(WEDNESDAY)).toBe("2026-06-15");
  });
});
