import { lastMealBefore, lastMealWhen, todaysMeals } from "../../../app/home/homeMeals";
import type { MealType, PlannedMeal } from "../../../features/meal-plans/types";

const TODAY = "2026-11-19";

const meal = (id: string, plannedFor: string, mealType: MealType, recipeId: string | null = `r-${id}`): PlannedMeal => ({
  id,
  recipeId,
  recipeTitle: `Recipe ${id}`,
  plannedFor,
  mealType,
  servingsOverride: null,
  recipeServings: 4,
  effectiveServings: 4,
});

describe("todaysMeals", () => {
  it("keeps today's meals, breakfast first", () => {
    const meals = [
      meal("d", TODAY, "dinner"),
      meal("y", "2026-11-18", "dinner"),
      meal("b", TODAY, "breakfast"),
      meal("l", TODAY, "lunch"),
    ];
    expect(todaysMeals(meals, TODAY).map((m) => m.id)).toEqual(["b", "l", "d"]);
  });

  it("returns nothing when nothing is planned today", () => {
    expect(todaysMeals([meal("y", "2026-11-18", "dinner")], TODAY)).toEqual([]);
  });
});

describe("lastMealBefore", () => {
  it("picks the latest day before today, and that day's last meal", () => {
    const meals = [
      meal("old", "2026-11-15", "dinner"),
      meal("lunch", "2026-11-18", "lunch"),
      meal("dinner", "2026-11-18", "dinner"),
      meal("breakfast", "2026-11-18", "breakfast"),
      meal("today", TODAY, "breakfast"),
    ];
    expect(lastMealBefore(meals, TODAY)?.id).toBe("dinner");
  });

  it("skips meals whose recipe was deleted", () => {
    const meals = [meal("kept", "2026-11-17", "dinner"), meal("deleted", "2026-11-18", "dinner", null)];
    expect(lastMealBefore(meals, TODAY)?.id).toBe("kept");
  });

  it("returns null when there's no meal before today", () => {
    expect(lastMealBefore([meal("today", TODAY, "dinner")], TODAY)).toBeNull();
    expect(lastMealBefore([], TODAY)).toBeNull();
  });
});

describe("lastMealWhen", () => {
  it("says yesterday for yesterday's meal", () => {
    expect(lastMealWhen(meal("y", "2026-11-18", "dinner"), TODAY)).toBe("Yesterday's dinner");
  });

  it("names the day for earlier meals", () => {
    expect(lastMealWhen(meal("t", "2026-11-17", "lunch"), TODAY)).toBe("Tue, Nov 17 · Lunch");
  });
});
