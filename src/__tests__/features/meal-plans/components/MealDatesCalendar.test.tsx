import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../../utils/renderWithProviders";
import { describe, it, expect, vi, beforeEach } from "vitest";
import MealDatesCalendar from "../../../../features/meal-plans/components/MealDatesCalendar";
import type { PlannedMeal } from "../../../../features/meal-plans/types";
import { toIsoDate } from "../../../../lib/utils/dates";

vi.mock("../../../../features/meal-plans/api", () => ({
  listPlannedMealsBetween: vi.fn(),
}));

import { listPlannedMealsBetween } from "../../../../features/meal-plans/api";

const meal = (id: string, plannedFor: string): PlannedMeal => ({
  id,
  recipeId: `recipe-${id}`,
  recipeTitle: "Tacos",
  plannedFor,
  mealType: "dinner",
  servingsOverride: null,
  recipeServings: 4,
  effectiveServings: 4,
});

/** A date in the currently shown month (the calendar opens on today's month). */
const today = new Date();
const inThisMonth = (day: number) =>
  toIsoDate(new Date(today.getFullYear(), today.getMonth(), day));

function renderCalendar(
  props: { rangeStartIso?: string | null; rangeEndIso?: string | null } = {}
) {
  const onSelectDay = vi.fn();
  renderWithProviders(
    <MealDatesCalendar
      rangeStartIso={props.rangeStartIso ?? null}
      rangeEndIso={props.rangeEndIso ?? null}
      onSelectDay={onSelectDay}
    />
  );
  return { onSelectDay };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listPlannedMealsBetween).mockResolvedValue([]);
});

describe("MealDatesCalendar", () => {
  it("shows the current month and its day grid", () => {
    renderCalendar();
    const label = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(today);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByRole("grid", { name: label })).toBeInTheDocument();
  });

  it("loads the meals for the visible days, straight from their dates", async () => {
    renderCalendar();
    await waitFor(() => expect(listPlannedMealsBetween).toHaveBeenCalledTimes(1), { timeout: 1500 });
    // The grid covers whole weeks around the month, so the query spans them too.
    const [startIso, endIso] = vi.mocked(listPlannedMealsBetween).mock.calls[0];
    expect(startIso <= inThisMonth(1)).toBe(true);
    expect(endIso >= inThisMonth(28)).toBe(true);
  });

  it("marks the days that have meals", async () => {
    vi.mocked(listPlannedMealsBetween).mockResolvedValue([
      meal("a", inThisMonth(10)),
      meal("b", inThisMonth(10)),
      meal("c", inThisMonth(12)),
    ]);
    renderCalendar();
    await waitFor(() =>
      expect(screen.getByRole("gridcell", { name: inThisMonth(10) }).querySelector(".meal-dates-cal__day-dot")).not.toBeNull(),
    { timeout: 1500 });
    expect(screen.getByRole("gridcell", { name: inThisMonth(12) }).querySelector(".meal-dates-cal__day-dot")).not.toBeNull();
    expect(screen.getByRole("gridcell", { name: inThisMonth(11) }).querySelector(".meal-dates-cal__day-dot")).toBeNull();
  });

  it("reports any clicked day, with or without meals", async () => {
    const { onSelectDay } = renderCalendar();
    fireEvent.click(screen.getByRole("gridcell", { name: inThisMonth(10) }));
    expect(onSelectDay).toHaveBeenCalledWith(inThisMonth(10));
  });

  it("highlights the given range", () => {
    renderCalendar({ rangeStartIso: inThisMonth(10), rangeEndIso: inThisMonth(12) });
    for (const day of [10, 11, 12]) {
      expect(screen.getByRole("gridcell", { name: inThisMonth(day) })).toHaveAttribute("aria-selected", "true");
    }
    expect(screen.getByRole("gridcell", { name: inThisMonth(13) })).toHaveAttribute("aria-selected", "false");
  });

  it("navigates months and loads that month's meals", async () => {
    renderCalendar();
    await waitFor(() => expect(listPlannedMealsBetween).toHaveBeenCalledTimes(1), { timeout: 1500 });

    fireEvent.click(screen.getByRole("button", { name: /previous month/i }));
    const prev = new Date(today.getFullYear(), today.getMonth() - 1);
    const label = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(prev);
    expect(screen.getByText(label)).toBeInTheDocument();
    await waitFor(() => expect(listPlannedMealsBetween).toHaveBeenCalledTimes(2), { timeout: 1500 });
  });

  it("says when the visible month has no meals", async () => {
    renderCalendar();
    await waitFor(() =>
      expect(screen.getByText(/no meals planned this month/i)).toBeInTheDocument(),
    { timeout: 1500 });
  });
});
