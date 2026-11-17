import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import {
  createTestQueryClient,
  renderWithProviders,
  TEST_USER_ID,
} from "../../../utils/renderWithProviders";
import { prefetchMealPlanWeeks } from "../../../../features/meal-plans/queries";
import { MemoryRouter } from "react-router-dom";
import MealPlansPage from "../../../../features/meal-plans/pages/MealPlansPage";
import type { PlannedMeal } from "../../../../features/meal-plans/types";
import {
  createDateFromIso,
  getWeekStartIso,
  shiftWeekStartIso,
} from "../../../../lib/utils/dates";

vi.mock("../../../../features/meal-plans/api", () => ({
  listPlannedMealsBetween: vi.fn().mockResolvedValue([]),
  listPlannedMealsForWeek: vi.fn().mockResolvedValue([]),
  applySavedPlan: vi.fn(),
  copyMealsBetween: vi.fn(),
  deletePlannedMeal: vi.fn(),
  movePlannedMeal: vi.fn(),
  updatePlannedMealServings: vi.fn(),
  previewSavedMealPlan: vi.fn(),
  saveMealsAsPlan: vi.fn(),
  searchSavedMealPlans: vi.fn().mockResolvedValue([]),
}));

import { deletePlannedMeal, listPlannedMealsForWeek } from "../../../../features/meal-plans/api";

const mockListPlannedMealsForWeek = vi.mocked(listPlannedMealsForWeek);

const THIS_WEEK = getWeekStartIso(new Date());
const NEXT_WEEK = shiftWeekStartIso(THIS_WEEK, 1);

const item = (id: string, recipeTitle: string, plannedFor: string): PlannedMeal => ({
  id,
  recipeId: `recipe-${id}`,
  recipeTitle,
  plannedFor,
  mealType: "dinner",
  servingsOverride: null,
  recipeServings: 4,
  effectiveServings: 4,
});

const ITEMS_BY_WEEK: Record<string, PlannedMeal[]> = {
  [THIS_WEEK]: [item("a", "Tacos", THIS_WEEK)],
  [NEXT_WEEK]: [item("b", "Lasagna", NEXT_WEEK)],
};

const T = { timeout: 1500 };

const renderPage = (
  initialEntries: Parameters<typeof MemoryRouter>[0]["initialEntries"],
  client = createTestQueryClient()
) =>
  renderWithProviders(
    <MemoryRouter initialEntries={initialEntries}>
      <MealPlansPage />
    </MemoryRouter>,
    { client }
  );

describe("MealPlansPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    mockListPlannedMealsForWeek.mockResolvedValue([]);
  });

  it("jumps to the week containing an incoming jumpToDate", async () => {
    const jumpToDate = "2026-03-18";
    const expectedWeekStartIso = getWeekStartIso(createDateFromIso(jumpToDate));

    renderPage([{ pathname: "/app/meal-plans", state: { jumpToDate } }]);

    await waitFor(() => {
      expect(mockListPlannedMealsForWeek).toHaveBeenCalledWith(expectedWeekStartIso);
    });
  });

  it("opens Browse plans on Calendar by default", () => {
    renderPage(["/app/meal-plans"]);
    expect(screen.getByRole("tab", { name: "Calendar" })).toHaveAttribute("aria-selected", "true");
  });

  // Coming back from the Saved Meal Plans page.
  it("opens Browse plans on Saved plans when asked to", () => {
    renderPage([{ pathname: "/app/meal-plans", state: { planBrowserTab: "saved" } }]);
    expect(screen.getByRole("tab", { name: "Saved plans" })).toHaveAttribute("aria-selected", "true");
  });

  it("falls back to the current week when there is no jumpToDate", async () => {
    const expectedWeekStartIso = getWeekStartIso(new Date());

    renderPage(["/app/meal-plans"]);

    await waitFor(() => {
      expect(mockListPlannedMealsForWeek).toHaveBeenCalledWith(expectedWeekStartIso);
    });
  });
});

// The planner used to keep weeks in a sessionStorage cache so revisits showed
// instantly. That cache was removed (it had to be rewritten after every
// change and cleared on sign-out); weeks now load on demand, and the shared
// LoadingModal only appears when a load is slow.
describe("MealPlansPage — loading weeks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    mockListPlannedMealsForWeek.mockImplementation(async (weekStartIso) => ITEMS_BY_WEEK[weekStartIso] ?? []);
  });

  // Behavior change: the planner used to show its modal immediately and keep
  // it up for at least 480 ms. LoadingModal now applies one shared timing
  // everywhere: it only appears if loading takes longer than ~280 ms.
  it("does not flash the loading modal when a load is fast", async () => {
    renderPage(["/app/meal-plans"]);
    expect(await screen.findByText("Tacos", undefined, T)).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("shows the loading modal when a load is slow, then the week's meals", async () => {
    // The planner also prefetches neighbouring weeks, so hold each week's
    // request separately and release only the one being viewed.
    const pending = new Map<string, () => void>();
    mockListPlannedMealsForWeek.mockImplementation(
      (weekStartIso) =>
        new Promise((resolve) => {
          pending.set(weekStartIso, () => resolve(ITEMS_BY_WEEK[weekStartIso] ?? []));
        })
    );
    const finishLoading = () => pending.get(THIS_WEEK)?.();
    renderPage(["/app/meal-plans"]);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    expect(await screen.findByRole("alertdialog", undefined, T)).toHaveTextContent(
      /loading meal planner/i
    );

    await act(async () => finishLoading());
    expect(await screen.findByText("Tacos", undefined, T)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(), T);
  });

  it("shows prefetched weeks immediately, with no loading state", async () => {
    // What sign-in prefetching gives the user: the planner opens fully drawn.
    const client = createTestQueryClient();
    await prefetchMealPlanWeeks(client, TEST_USER_ID, [THIS_WEEK, NEXT_WEEK]);
    mockListPlannedMealsForWeek.mockClear();

    renderPage(["/app/meal-plans"], client);
    expect(screen.getByText("Tacos")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next week" }));
    expect(screen.getByText("Lasagna")).toBeInTheDocument();
    expect(mockListPlannedMealsForWeek).not.toHaveBeenCalledWith(THIS_WEEK);
  });

  it("loads the next week, showing its meals once they arrive", async () => {
    renderPage(["/app/meal-plans"]);
    await screen.findByText("Tacos", undefined, T);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(), T);

    fireEvent.click(screen.getByRole("button", { name: "Next week" }));
    expect(screen.queryByText("Tacos")).not.toBeInTheDocument();

    expect(await screen.findByText("Lasagna", undefined, T)).toBeInTheDocument();
    expect(mockListPlannedMealsForWeek).toHaveBeenCalledWith(NEXT_WEEK);
  });

  it("ignores a slow response for a week the user has already left", async () => {
    let releaseThisWeek!: () => void;
    mockListPlannedMealsForWeek.mockImplementation((weekStartIso) =>
      weekStartIso === THIS_WEEK
        ? new Promise((resolve) => {
            releaseThisWeek = () => resolve(ITEMS_BY_WEEK[THIS_WEEK]);
          })
        : Promise.resolve(ITEMS_BY_WEEK[weekStartIso] ?? [])
    );
    renderPage(["/app/meal-plans"]);

    fireEvent.click(screen.getByRole("button", { name: "Next week" }));
    expect(await screen.findByText("Lasagna", undefined, T)).toBeInTheDocument();

    await act(async () => releaseThisWeek());
    expect(screen.queryByText("Tacos")).not.toBeInTheDocument();
    expect(screen.getByText("Lasagna")).toBeInTheDocument();
  });

  it("removes an item from the calendar after deleting it", async () => {
    vi.mocked(deletePlannedMeal).mockResolvedValue(undefined);
    renderPage(["/app/meal-plans"]);
    await screen.findByText("Tacos", undefined, T);

    fireEvent.click(screen.getByRole("button", { name: "Remove Tacos" }));

    await waitFor(() => expect(screen.queryByText("Tacos")).not.toBeInTheDocument(), T);
    expect(deletePlannedMeal).toHaveBeenCalledWith("a");
  });

  it("shows an action error, and clears it when changing weeks", async () => {
    vi.mocked(deletePlannedMeal).mockRejectedValue(new Error("Could not delete"));
    renderPage(["/app/meal-plans"]);
    await screen.findByText("Tacos", undefined, T);

    fireEvent.click(screen.getByRole("button", { name: "Remove Tacos" }));
    expect(await screen.findByText("Could not delete", undefined, T)).toBeInTheDocument();
    expect(screen.getByText("Tacos")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next week" }));
    expect(screen.queryByText("Could not delete")).not.toBeInTheDocument();
  });

  it("shows the error when a week fails to load", async () => {
    mockListPlannedMealsForWeek.mockRejectedValue(new Error("Network down"));
    renderPage(["/app/meal-plans"]);
    expect(await screen.findByText("Network down", undefined, T)).toBeInTheDocument();
  });
});
