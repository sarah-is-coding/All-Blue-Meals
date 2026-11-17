import { describe, it, expect } from "vitest";
import { groupMealsByDay } from "../../../../features/meal-plans/utils/groupMealsByDay";
import type { PlannedMeal } from "../../../../features/meal-plans/types";

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

describe("groupMealsByDay", () => {
  it("returns an empty array for no meals", () => {
    expect(groupMealsByDay([])).toEqual([]);
  });

  it("groups recipe titles by date", () => {
    const result = groupMealsByDay([
      meal("a", "2026-05-18", "Pasta"),
      meal("b", "2026-05-18", "Salad"),
      meal("c", "2026-05-19", "Soup"),
    ]);
    expect(result).toEqual([
      { dateIso: "2026-05-18", recipes: ["Pasta", "Salad"] },
      { dateIso: "2026-05-19", recipes: ["Soup"] },
    ]);
  });

  it("orders days by date even when meals arrive out of order", () => {
    const result = groupMealsByDay([
      meal("a", "2026-05-20", "Soup"),
      meal("b", "2026-05-18", "Pasta"),
      meal("c", "2026-05-19", "Stew"),
    ]);
    expect(result.map((day) => day.dateIso)).toEqual([
      "2026-05-18",
      "2026-05-19",
      "2026-05-20",
    ]);
  });

  it("does not mutate the input array", () => {
    const meals = [meal("a", "2026-05-20", "Soup"), meal("b", "2026-05-18", "Pasta")];
    groupMealsByDay(meals);
    expect(meals.map((m) => m.id)).toEqual(["a", "b"]);
  });
});
