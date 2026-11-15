import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import MealPlannerCalendar from "../../../../features/meal-plans/components/MealPlannerCalendar";
import type { MealPlanItem, MealPlannerDay } from "../../../../features/meal-plans/types";

const weekDays: MealPlannerDay[] = [
  {
    dateIso: "2026-01-05",
    weekdayShort: "Mon",
    monthDayLabel: "Jan 5",
    fullLabel: "Monday, January 5",
  },
  {
    dateIso: "2026-01-06",
    weekdayShort: "Tue",
    monthDayLabel: "Jan 6",
    fullLabel: "Tuesday, January 6",
  },
];

const noop = async () => {};

function LocationProbe() {
  const location = useLocation();
  return <p>state: {JSON.stringify(location.state)}</p>;
}

const renderCalendar = () =>
  render(
    <MemoryRouter initialEntries={["/app/meal-plans"]}>
      <Routes>
        <Route
          path="/app/meal-plans"
          element={
            <MealPlannerCalendar
              weekLabel="Jan 5 - Jan 11, 2026"
              weekDays={weekDays}
              items={[]}
              removingItemId={null}
              movingItemId={null}
              updatingServingsItemId={null}
              onShiftWeek={() => {}}
              onJumpToCurrentWeek={() => {}}
              onMoveItem={noop}
              onUpdateItemServings={noop}
              onRemoveItem={noop}
            />
          }
        />
        <Route path="/app/recipes" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>
  );

describe("MealPlannerCalendar", () => {
  it("shows a Search recipes link on every slot", () => {
    renderCalendar();

    const dinnerSlot = screen.getByRole("region", { name: "Dinner on Monday, January 5" });
    expect(within(dinnerSlot).getByRole("link", { name: "Search recipes" })).toBeInTheDocument();

    const breakfastSlot = screen.getByRole("region", { name: "Breakfast on Tuesday, January 6" });
    expect(
      within(breakfastSlot).getByRole("link", { name: "Search recipes" })
    ).toBeInTheDocument();
  });

  it("navigates to the recipe search page carrying the slot's date and meal type", async () => {
    const user = userEvent.setup();
    renderCalendar();

    const dinnerSlot = screen.getByRole("region", { name: "Dinner on Monday, January 5" });
    await user.click(within(dinnerSlot).getByRole("link", { name: "Search recipes" }));

    expect(
      await screen.findByText(
        `state: ${JSON.stringify({ mealSlot: { date: "2026-01-05", mealType: "dinner" } })}`
      )
    ).toBeInTheDocument();
  });

  describe("picker mode", () => {
    const pickerItems: MealPlanItem[] = [
      {
        id: "item-1",
        recipeId: "recipe-1",
        recipeTitle: "Pasta Bake",
        plannedFor: "2026-01-05",
        mealType: "dinner",
        servingsOverride: null,
        recipeServings: 4,
        effectiveServings: 4,
      },
    ];

    const renderPicker = (
      selectedSlot: { date: string; mealType: "breakfast" | "lunch" | "dinner" } | null,
      onSelectSlot = vi.fn()
    ) => {
      render(
        <MemoryRouter>
          <MealPlannerCalendar
            weekLabel="Jan 5 - Jan 11, 2026"
            weekDays={weekDays}
            items={pickerItems}
            onShiftWeek={() => {}}
            onJumpToCurrentWeek={() => {}}
            selectedSlot={selectedSlot}
            onSelectSlot={onSelectSlot}
          />
        </MemoryRouter>
      );
      return onSelectSlot;
    };

    it("hides the Search recipes and Manage Saved Plans links", () => {
      renderPicker(null);

      expect(screen.queryByRole("link", { name: "Search recipes" })).not.toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: "Manage Saved Plans" })
      ).not.toBeInTheDocument();
    });

    it("calls onSelectSlot when a slot is clicked", async () => {
      const user = userEvent.setup();
      const onSelectSlot = renderPicker(null);

      const breakfastSlot = screen.getByRole("button", {
        name: "Breakfast on Tuesday, January 6",
      });
      await user.click(breakfastSlot);

      expect(onSelectSlot).toHaveBeenCalledWith("2026-01-06", "breakfast");
    });

    it("marks the matching slot as selected", () => {
      renderPicker({ date: "2026-01-05", mealType: "dinner" });

      const dinnerSlot = screen.getByRole("button", { name: "Dinner on Monday, January 5" });
      const lunchSlot = screen.getByRole("button", { name: "Lunch on Monday, January 5" });
      expect(dinnerSlot).toHaveAttribute("aria-pressed", "true");
      expect(lunchSlot).toHaveAttribute("aria-pressed", "false");
    });

    it("renders existing items read-only, with no remove or servings controls", () => {
      renderPicker(null);

      const dinnerSlot = screen.getByRole("button", { name: "Dinner on Monday, January 5" });
      expect(within(dinnerSlot).getByText("Pasta Bake")).toBeInTheDocument();
      expect(within(dinnerSlot).getByText("4 servings")).toBeInTheDocument();
      expect(within(dinnerSlot).queryByRole("button", { name: /remove/i })).not.toBeInTheDocument();
    });
  });
});
