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
  props: { rangeStartIso?: string | null; rangeEndIso?: string | null; weekStartsOn?: 0 | 1 } = {}
) {
  const onSelectDay = vi.fn();
  renderWithProviders(
    <MealDatesCalendar
      rangeStartIso={props.rangeStartIso ?? null}
      rangeEndIso={props.rangeEndIso ?? null}
      onSelectDay={onSelectDay}
    />,
    { preferences: { weekStartsOn: props.weekStartsOn ?? 0 } }
  );
  return { onSelectDay };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listPlannedMealsBetween).mockResolvedValue([]);
});

const weekdayHeader = () =>
  Array.from(document.querySelectorAll(".meal-dates-cal__weekday")).map((cell) => cell.textContent);
const gridDays = () => screen.getAllByRole("gridcell").map((cell) => cell.getAttribute("aria-label") ?? "");
const dayOfWeek = (iso: string) => new Date(`${iso}T12:00:00`).getDay();

describe("MealDatesCalendar", () => {
  it("lays out weeks Sunday to Saturday by default", () => {
    renderCalendar();
    expect(weekdayHeader()).toEqual(["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]);
    const days = gridDays();
    expect(dayOfWeek(days[0]!)).toBe(0);
    expect(dayOfWeek(days[days.length - 1]!)).toBe(6);
  });

  it("lays out weeks Monday to Sunday when the user's weeks start on Monday", () => {
    renderCalendar({ weekStartsOn: 1 });
    expect(weekdayHeader()).toEqual(["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]);
    const days = gridDays();
    expect(days.length % 7).toBe(0);
    expect(dayOfWeek(days[0]!)).toBe(1);
    expect(dayOfWeek(days[days.length - 1]!)).toBe(0);
    // The month's first day is in the first row.
    expect(days.slice(0, 7)).toContain(inThisMonth(1));
  });

  it("rounds the selection band at the user's week edges", () => {
    // A range covering a whole month: the band breaks at the end of each week row.
    renderCalendar({ rangeStartIso: inThisMonth(1), rangeEndIso: inThisMonth(28), weekStartsOn: 1 });
    for (const cell of document.querySelectorAll(".meal-dates-cal__day--band-right")) {
      const iso = cell.getAttribute("aria-label")!;
      expect(iso === inThisMonth(28) || dayOfWeek(iso) === 0).toBe(true);
    }
  });

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

  // An empty month is represented by a calendar with no meal markers.
  it("keeps an empty month selectable without showing a message", async () => {
    renderCalendar();
    await waitFor(() =>
      expect(screen.queryByText("Loading…")).not.toBeInTheDocument(),
    { timeout: 1500 });
    expect(screen.getByRole("gridcell", { name: inThisMonth(10) })).toBeEnabled();
    expect(screen.getByRole("grid").querySelector(".meal-dates-cal__day-dot")).toBeNull();
    expect(screen.queryByText(/no meals planned this month/i)).not.toBeInTheDocument();
  });

  describe("changing month", () => {
    const monthLabel = (monthOffset: number) =>
      new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(
        new Date(today.getFullYear(), today.getMonth() + monthOffset)
      );
    const calendar = () => screen.getByRole("grid").parentElement!;
    const swipe = (fromX: number, toX: number, fromY = 100, toY = 100) => {
      fireEvent.touchStart(calendar(), { touches: [{ clientX: fromX, clientY: fromY }] });
      fireEvent.touchEnd(calendar(), { changedTouches: [{ clientX: toX, clientY: toY }] });
    };

    it("moves a month with the arrow buttons, across a year end", () => {
      renderCalendar();
      fireEvent.click(screen.getByRole("button", { name: "Next month" }));
      expect(screen.getByText(monthLabel(1))).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
      fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
      expect(screen.getByText(monthLabel(-1))).toBeInTheDocument();

      for (let i = 0; i < 13; i++) fireEvent.click(screen.getByRole("button", { name: "Next month" }));
      expect(screen.getByText(monthLabel(12))).toBeInTheDocument();
    });

    it("swiping left shows the next month, and right the previous", () => {
      renderCalendar();
      swipe(200, 100);
      expect(screen.getByText(monthLabel(1))).toBeInTheDocument();
      swipe(100, 200);
      swipe(100, 200);
      expect(screen.getByText(monthLabel(-1))).toBeInTheDocument();
    });

    it("doesn't change month when the finger moves up or down (scrolling the page)", () => {
      renderCalendar();
      swipe(200, 150, 100, 400);
      expect(screen.getByText(monthLabel(0))).toBeInTheDocument();
    });

    it("loads the meals for the month swiped to", async () => {
      renderCalendar();
      swipe(200, 100);
      const firstOfNext = toIsoDate(new Date(today.getFullYear(), today.getMonth() + 1, 1));
      await waitFor(() => {
        const ranges = vi.mocked(listPlannedMealsBetween).mock.calls;
        expect(ranges.some(([start, end]) => start <= firstOfNext && end >= firstOfNext)).toBe(true);
      }, { timeout: 1500 });
    });

    it("pages with sideways trackpad scrolling, one month per swipe", () => {
      renderCalendar();
      fireEvent.wheel(calendar(), { deltaX: 80, deltaY: 0 });
      fireEvent.wheel(calendar(), { deltaX: 80, deltaY: 0 }); // the same swipe's momentum
      expect(screen.getByText(monthLabel(1))).toBeInTheDocument();
    });

    it("ignores up/down wheel scrolling", () => {
      renderCalendar();
      fireEvent.wheel(calendar(), { deltaX: 0, deltaY: 300 });
      expect(screen.getByText(monthLabel(0))).toBeInTheDocument();
    });
  });
});
