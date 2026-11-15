import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../../utils/renderWithProviders";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AddToPlanModal from "../../../../features/meal-plans/components/AddToPlanModal";
import {
  formatWeekRangeLabel,
  getWeekStartIso,
  shiftWeekStartIso,
  toIsoDate,
} from "../../../../lib/utils/dates";
import { getWeekDays } from "../../../../features/meal-plans/utils/weekDays";
import type { MealPlanItem } from "../../../../features/meal-plans/types";

vi.mock("../../../../features/meal-plans/api", () => ({
  listMealPlanItemsForWeek: vi.fn(),
}));

import { listMealPlanItemsForWeek } from "../../../../features/meal-plans/api";

const mockListMealPlanItemsForWeek = vi.mocked(listMealPlanItemsForWeek);

const renderModal = (
  props: Partial<React.ComponentProps<typeof AddToPlanModal>> = {}
) => {
  const onCancel = vi.fn();
  const onConfirm = vi.fn().mockResolvedValue(undefined);
  renderWithProviders(
    <MemoryRouter>
      <AddToPlanModal
        recipeTitle="Pasta Bake"
        recipeServings={4}
        onCancel={onCancel}
        onConfirm={onConfirm}
        confirming={false}
        {...props}
      />
    </MemoryRouter>
  );
  return { onCancel, onConfirm };
};

describe("AddToPlanModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListMealPlanItemsForWeek.mockResolvedValue([]);
  });

  it("defaults to next week and disables Add recipe until a slot is picked", async () => {
    const expectedWeekStartIso = shiftWeekStartIso(getWeekStartIso(new Date()), 1);
    renderModal();

    await waitFor(() => {
      expect(mockListMealPlanItemsForWeek).toHaveBeenCalledWith(expectedWeekStartIso);
    });
    expect(
      screen.getByText(formatWeekRangeLabel(expectedWeekStartIso))
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add recipe" })).toBeDisabled();
  });

  it("scopes to the initial day's week and preselects that slot", async () => {
    const farFutureDate = new Date();
    farFutureDate.setDate(farFutureDate.getDate() + 30);
    const initialDay = toIsoDate(farFutureDate);
    const expectedWeekStartIso = getWeekStartIso(farFutureDate);
    const expectedDay = getWeekDays(expectedWeekStartIso).find(
      (day) => day.dateIso === initialDay
    );

    renderModal({ initialDay, initialMealType: "breakfast" });

    await waitFor(() => {
      expect(mockListMealPlanItemsForWeek).toHaveBeenCalledWith(expectedWeekStartIso);
    });

    const slot = screen.getByRole("button", {
      name: `Breakfast on ${expectedDay?.fullLabel}`,
    });
    expect(slot).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Add recipe" })).toBeEnabled();
  });

  it("selects a slot, then confirms with the chosen day/meal and servings", async () => {
    const expectedWeekStartIso = shiftWeekStartIso(getWeekStartIso(new Date()), 1);
    const weekDays = getWeekDays(expectedWeekStartIso);
    const user = userEvent.setup();
    const { onConfirm } = renderModal();

    await screen.findByText(formatWeekRangeLabel(expectedWeekStartIso));

    const targetDay = weekDays[2];
    await user.click(screen.getByRole("button", { name: `Lunch on ${targetDay.fullLabel}` }));
    await user.click(screen.getByRole("button", { name: "Add recipe" }));

    expect(onConfirm).toHaveBeenCalledWith(targetDay.dateIso, "lunch", null);
  });

  it("steps to the next week, keeping the same weekday selected, and refetches items", async () => {
    const initialWeekStartIso = shiftWeekStartIso(getWeekStartIso(new Date()), 1);
    const initialWeekDays = getWeekDays(initialWeekStartIso);
    const user = userEvent.setup();
    renderModal();

    await screen.findByText(formatWeekRangeLabel(initialWeekStartIso));

    await user.click(
      screen.getByRole("button", { name: `Dinner on ${initialWeekDays[3].fullLabel}` })
    );
    await user.click(screen.getByRole("button", { name: "Next week" }));

    const nextWeekStartIso = shiftWeekStartIso(initialWeekStartIso, 1);
    const nextWeekDays = getWeekDays(nextWeekStartIso);

    await waitFor(() => {
      expect(mockListMealPlanItemsForWeek).toHaveBeenCalledWith(nextWeekStartIso);
    });
    expect(screen.getByText(formatWeekRangeLabel(nextWeekStartIso))).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: `Dinner on ${nextWeekDays[3].fullLabel}` })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("shows existing items for the week in the embedded calendar", async () => {
    const expectedWeekStartIso = shiftWeekStartIso(getWeekStartIso(new Date()), 1);
    const weekDays = getWeekDays(expectedWeekStartIso);
    const existingItem: MealPlanItem = {
      id: "item-1",
      recipeId: "recipe-1",
      recipeTitle: "Already Planned Soup",
      plannedFor: weekDays[0].dateIso,
      mealType: "dinner",
      servingsOverride: null,
      recipeServings: 2,
      effectiveServings: 2,
    };
    mockListMealPlanItemsForWeek.mockResolvedValue([existingItem]);

    renderModal();

    expect(screen.getByText("Loading your plan for this week…")).toBeInTheDocument();
    expect(await screen.findByText("Already Planned Soup")).toBeInTheDocument();
  });

  it("shows an error when loading the week's items fails", async () => {
    mockListMealPlanItemsForWeek.mockRejectedValue(new Error("Failed to load your meal plan."));
    renderModal();

    expect(
      await screen.findByText("Failed to load your meal plan.")
    ).toBeInTheDocument();
  });

  it("calls onCancel when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const { onCancel } = renderModal();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalled();
  });
});
