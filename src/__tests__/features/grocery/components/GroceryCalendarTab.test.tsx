import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "../../../utils/renderWithProviders";
import GroceryCalendarTab from "../../../../features/grocery/components/GroceryCalendarTab";
import type { PlannedMeal } from "../../../../features/meal-plans/types";

vi.mock("../../../../features/meal-plans/api", () => ({
  listPlannedMealsBetween: vi.fn(),
}));

import { listPlannedMealsBetween } from "../../../../features/meal-plans/api";

const T = { timeout: 1500 };

const meal = (id: string, plannedFor: string, recipeTitle: string): PlannedMeal => ({
  id,
  recipeId: `recipe-${id}`,
  recipeTitle,
  plannedFor,
  mealType: "dinner",
  servingsOverride: null,
  recipeServings: 4,
  effectiveServings: 4,
});

function renderTab() {
  const onChange = vi.fn();
  renderWithProviders(
    <GroceryCalendarTab startIso="2026-05-24" endIso="2026-05-30" onChange={onChange} />
  );
  return { onChange };
}

// More of this tab is covered through GroceryPage.test.tsx.
describe("GroceryCalendarTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listPlannedMealsBetween).mockResolvedValue([]);
  });

  it("shows the chosen dates in the From/To fields", () => {
    renderTab();
    expect(screen.getByLabelText("From")).toHaveValue("2026-05-24");
    expect(screen.getByLabelText("To")).toHaveValue("2026-05-30");
  });

  it("moves the whole range a week at a time, keeping its length", () => {
    const { onChange } = renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Move dates forward a week" }));
    expect(onChange).toHaveBeenLastCalledWith("2026-05-31", "2026-06-06");
    fireEvent.click(screen.getByRole("button", { name: "Move dates back a week" }));
    expect(onChange).toHaveBeenLastCalledWith("2026-05-17", "2026-05-23");
  });

  // Behavior change: the "Meals in these dates" preview was removed from the
  // grocery page; only the count is shown.
  it("counts the meals planned in the dates, without listing them", async () => {
    vi.mocked(listPlannedMealsBetween).mockResolvedValue([
      meal("a", "2026-05-25", "Tacos"),
      meal("b", "2026-05-26", "Soup"),
    ]);
    renderTab();
    expect(await screen.findByText("2 planned meals in these dates", undefined, T)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Meals in these dates" })).not.toBeInTheDocument();
    expect(screen.queryByText("Soup")).not.toBeInTheDocument();
    expect(listPlannedMealsBetween).toHaveBeenCalledWith("2026-05-24", "2026-05-30");
  });

  it("shows a load error instead of the count", async () => {
    vi.mocked(listPlannedMealsBetween).mockRejectedValue(new Error("Network down"));
    renderTab();
    expect(await screen.findByText("Network down", undefined, T)).toBeInTheDocument();
    expect(screen.queryByText(/planned meal/)).not.toBeInTheDocument();
  });
});
