import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import {
  createTestQueryClient,
  renderWithProviders,
  TEST_USER_ID,
} from "../../../utils/renderWithProviders";
import { prefetchMealPlanWeeks } from "../../../../features/meal-plans/queries";
import { MemoryRouter } from "react-router-dom";
import MealPlansPage from "../../../../features/meal-plans/pages/MealPlansPage";
import type { MealPlanItem } from "../../../../features/meal-plans/types";
import {
  createDateFromIso,
  getWeekStartIso,
  shiftWeekStartIso,
} from "../../../../lib/utils/dates";

vi.mock("../../../../features/meal-plans/api", () => ({
  listMealPlanItemsForWeek: vi.fn().mockResolvedValue([]),
  applySavedMealPlan: vi.fn(),
  clearWeekPlan: vi.fn(),
  deleteMealPlanItem: vi.fn(),
  moveMealPlanItem: vi.fn(),
  updateMealPlanItemServings: vi.fn(),
  listMealPlanSpans: vi.fn().mockResolvedValue([]),
  previewSavedMealPlan: vi.fn(),
  savePlanById: vi.fn(),
  searchSavedMealPlans: vi.fn().mockResolvedValue([]),
}));

import { deleteMealPlanItem, listMealPlanItemsForWeek } from "../../../../features/meal-plans/api";

const mockListMealPlanItemsForWeek = vi.mocked(listMealPlanItemsForWeek);

const THIS_WEEK = getWeekStartIso(new Date());
const NEXT_WEEK = shiftWeekStartIso(THIS_WEEK, 1);

const item = (id: string, recipeTitle: string, plannedFor: string): MealPlanItem => ({
  id,
  recipeId: `recipe-${id}`,
  recipeTitle,
  plannedFor,
  mealType: "dinner",
  servingsOverride: null,
  recipeServings: 4,
  effectiveServings: 4,
});

const ITEMS_BY_WEEK: Record<string, MealPlanItem[]> = {
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
    mockListMealPlanItemsForWeek.mockResolvedValue([]);
  });

  it("jumps to the week containing an incoming jumpToDate", async () => {
    const jumpToDate = "2026-03-18";
    const expectedWeekStartIso = getWeekStartIso(createDateFromIso(jumpToDate));

    renderPage([{ pathname: "/app/meal-plans", state: { jumpToDate } }]);

    await waitFor(() => {
      expect(mockListMealPlanItemsForWeek).toHaveBeenCalledWith(expectedWeekStartIso);
    });
  });

  it("falls back to the current week when there is no jumpToDate", async () => {
    const expectedWeekStartIso = getWeekStartIso(new Date());

    renderPage(["/app/meal-plans"]);

    await waitFor(() => {
      expect(mockListMealPlanItemsForWeek).toHaveBeenCalledWith(expectedWeekStartIso);
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
    mockListMealPlanItemsForWeek.mockImplementation(async (weekStartIso) => ITEMS_BY_WEEK[weekStartIso] ?? []);
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
    mockListMealPlanItemsForWeek.mockImplementation(
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
    mockListMealPlanItemsForWeek.mockClear();

    renderPage(["/app/meal-plans"], client);
    expect(screen.getByText("Tacos")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next week" }));
    expect(screen.getByText("Lasagna")).toBeInTheDocument();
    expect(mockListMealPlanItemsForWeek).not.toHaveBeenCalledWith(THIS_WEEK);
  });

  it("loads the next week, showing its meals once they arrive", async () => {
    renderPage(["/app/meal-plans"]);
    await screen.findByText("Tacos", undefined, T);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(), T);

    fireEvent.click(screen.getByRole("button", { name: "Next week" }));
    expect(screen.queryByText("Tacos")).not.toBeInTheDocument();

    expect(await screen.findByText("Lasagna", undefined, T)).toBeInTheDocument();
    expect(mockListMealPlanItemsForWeek).toHaveBeenCalledWith(NEXT_WEEK);
  });

  it("ignores a slow response for a week the user has already left", async () => {
    let releaseThisWeek!: () => void;
    mockListMealPlanItemsForWeek.mockImplementation((weekStartIso) =>
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
    vi.mocked(deleteMealPlanItem).mockResolvedValue(undefined);
    renderPage(["/app/meal-plans"]);
    await screen.findByText("Tacos", undefined, T);

    fireEvent.click(screen.getByRole("button", { name: "Remove Tacos" }));

    await waitFor(() => expect(screen.queryByText("Tacos")).not.toBeInTheDocument(), T);
    expect(deleteMealPlanItem).toHaveBeenCalledWith("a");
  });

  it("shows an action error, and clears it when changing weeks", async () => {
    vi.mocked(deleteMealPlanItem).mockRejectedValue(new Error("Could not delete"));
    renderPage(["/app/meal-plans"]);
    await screen.findByText("Tacos", undefined, T);

    fireEvent.click(screen.getByRole("button", { name: "Remove Tacos" }));
    expect(await screen.findByText("Could not delete", undefined, T)).toBeInTheDocument();
    expect(screen.getByText("Tacos")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next week" }));
    expect(screen.queryByText("Could not delete")).not.toBeInTheDocument();
  });

  it("shows the error when a week fails to load", async () => {
    mockListMealPlanItemsForWeek.mockRejectedValue(new Error("Network down"));
    renderPage(["/app/meal-plans"]);
    expect(await screen.findByText("Network down", undefined, T)).toBeInTheDocument();
  });
});
