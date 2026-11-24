import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../../utils/renderWithProviders";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AddToPlanButton from "../../../../features/meal-plans/components/AddToPlanButton";
import { getWeekDays } from "../../../../features/meal-plans/utils/weekDays";
import { getWeekStartIso, shiftWeekStartIso, toIsoDate } from "../../../../lib/utils/dates";

const navigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom"
  );
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

vi.mock("../../../../features/meal-plans/api", () => ({
  addPlannedMeal: vi.fn(),
  listPlannedMealsForWeek: vi.fn(),
}));

import { addPlannedMeal, listPlannedMealsForWeek } from "../../../../features/meal-plans/api";

const mockAddPlannedMeal = vi.mocked(addPlannedMeal);
const mockListPlannedMealsForWeek = vi.mocked(listPlannedMealsForWeek);

const renderButton = (props: Partial<React.ComponentProps<typeof AddToPlanButton>> = {}) =>
  renderWithProviders(
    <MemoryRouter>
      <AddToPlanButton
        recipeId="recipe-1"
        recipeTitle="Pasta Bake"
        recipeServings={4}
        {...props}
      />
    </MemoryRouter>
  );

describe("AddToPlanButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListPlannedMealsForWeek.mockResolvedValue([]);
  });

  it("opens the Add to Plan modal with the recipe name", async () => {
    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByRole("button", { name: "Add to Plan" }));

    expect(
      await screen.findByRole("dialog", { name: "Add Pasta Bake to your meal plan" })
    ).toBeInTheDocument();
    expect(screen.getByText("Pasta Bake")).toBeInTheDocument();
  });

  it("assigns the recipe to a picked slot and offers to view it on the meal plan", async () => {
    mockAddPlannedMeal.mockResolvedValue({
      id: "item-1",
      recipeId: "recipe-1",
      recipeTitle: "Pasta Bake",
      plannedFor: "2026-01-01",
      mealType: "lunch",
      servingsOverride: null,
      recipeServings: 4,
      effectiveServings: 4,
    });

    const expectedWeekStartIso = shiftWeekStartIso(getWeekStartIso(new Date(), 0), 1);
    const targetDay = getWeekDays(expectedWeekStartIso)[2];

    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByRole("button", { name: "Add to Plan" }));
    await user.click(
      await screen.findByRole("button", { name: `Lunch on ${targetDay.fullLabel}` })
    );
    await user.click(screen.getByRole("button", { name: "Add recipe" }));

    await waitFor(() => {
      expect(mockAddPlannedMeal).toHaveBeenCalledWith({
        plannedFor: targetDay.dateIso,
        mealType: "lunch",
        recipeId: "recipe-1",
        servingsOverride: null,
      });
    });

    expect(
      screen.queryByRole("dialog", { name: "Add Pasta Bake to your meal plan" })
    ).not.toBeInTheDocument();

    const confirmDialog = await screen.findByRole("dialog", { name: "Recipe added to plan" });
    expect(confirmDialog).toHaveTextContent("Added to your meal plan.");

    await user.click(screen.getByRole("button", { name: "View meal plan" }));

    expect(navigate).toHaveBeenCalledWith("/meal-plans", {
      state: { jumpToDate: targetDay.dateIso },
    });
    expect(screen.queryByRole("dialog", { name: "Recipe added to plan" })).not.toBeInTheDocument();
  });

  it("dismisses the added-to-plan confirmation without navigating", async () => {
    mockAddPlannedMeal.mockResolvedValue({
      id: "item-1",
      recipeId: "recipe-1",
      recipeTitle: "Pasta Bake",
      plannedFor: "2026-01-01",
      mealType: "lunch",
      servingsOverride: null,
      recipeServings: 4,
      effectiveServings: 4,
    });

    const expectedWeekStartIso = shiftWeekStartIso(getWeekStartIso(new Date(), 0), 1);
    const targetDay = getWeekDays(expectedWeekStartIso)[2];

    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByRole("button", { name: "Add to Plan" }));
    await user.click(
      await screen.findByRole("button", { name: `Lunch on ${targetDay.fullLabel}` })
    );
    await user.click(screen.getByRole("button", { name: "Add recipe" }));

    await screen.findByRole("dialog", { name: "Recipe added to plan" });
    await user.click(screen.getByRole("button", { name: "Stay here" }));

    expect(screen.queryByRole("dialog", { name: "Recipe added to plan" })).not.toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("preselects the initial day and meal so Add recipe is immediately available", async () => {
    const farFutureDate = new Date();
    farFutureDate.setDate(farFutureDate.getDate() + 30);
    const initialDay = toIsoDate(farFutureDate);
    const expectedWeekStartIso = getWeekStartIso(farFutureDate, 0);
    const expectedDay = getWeekDays(expectedWeekStartIso).find(
      (day) => day.dateIso === initialDay
    );

    const user = userEvent.setup();
    renderButton({ initialDay, initialMealType: "breakfast" });

    await user.click(screen.getByRole("button", { name: "Add to Plan" }));

    const slot = await screen.findByRole("button", {
      name: `Breakfast on ${expectedDay?.fullLabel}`,
    });
    expect(slot).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Add recipe" })).toBeEnabled();
  });

  it("shows an error message when assignment fails", async () => {
    mockAddPlannedMeal.mockRejectedValue(new Error("Failed to add recipe to plan."));

    const expectedWeekStartIso = shiftWeekStartIso(getWeekStartIso(new Date(), 0), 1);
    const targetDay = getWeekDays(expectedWeekStartIso)[2];

    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByRole("button", { name: "Add to Plan" }));
    await user.click(
      await screen.findByRole("button", { name: `Lunch on ${targetDay.fullLabel}` })
    );
    await user.click(screen.getByRole("button", { name: "Add recipe" }));

    expect(await screen.findByText("Failed to add recipe to plan.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Recipe added to plan" })).not.toBeInTheDocument();
  });
});
