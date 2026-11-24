import { dayLabel, mealsOn, mealTypeLabel, nearestMealDay } from "../../../app/home/homeMeals";
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

describe("mealsOn", () => {
  it("keeps that day's meals, breakfast first", () => {
    const meals = [
      meal("d", TODAY, "dinner"),
      meal("y", "2026-11-18", "dinner"),
      meal("b", TODAY, "breakfast"),
      meal("l", TODAY, "lunch"),
    ];
    expect(mealsOn(meals, TODAY).map((m) => m.id)).toEqual(["b", "l", "d"]);
  });

  it("works for any day, such as tomorrow", () => {
    const meals = [meal("t", TODAY, "dinner"), meal("n", "2026-11-20", "lunch")];
    expect(mealsOn(meals, "2026-11-20").map((m) => m.id)).toEqual(["n"]);
  });

  it("returns nothing when nothing is planned that day", () => {
    expect(mealsOn([meal("y", "2026-11-18", "dinner")], TODAY)).toEqual([]);
    expect(mealsOn([], TODAY)).toEqual([]);
  });
});

// One lookup for both directions. It replaces nextMealDay and lastMealBefore,
// which picked only the last day's final meal: the home page now shows every
// meal on the last day, like the next day's.
describe("nearestMealDay", () => {
  const meals = [
    meal("old", "2026-11-15", "dinner"),
    meal("last-lunch", "2026-11-17", "lunch"),
    meal("last-dinner", "2026-11-17", "dinner"),
    meal("today", TODAY, "dinner"),
    meal("next", "2026-11-22", "lunch"),
    meal("later", "2026-11-25", "dinner"),
  ];

  it("finds the next day with a meal after today, however far off", () => {
    expect(nearestMealDay(meals, TODAY, "next")).toBe("2026-11-22");
  });

  it("finds the last day with a meal before today, however long ago", () => {
    expect(nearestMealDay(meals, TODAY, "last")).toBe("2026-11-17");
  });

  it("never picks today", () => {
    const onlyToday = [meal("today", TODAY, "dinner")];
    expect(nearestMealDay(onlyToday, TODAY, "next")).toBeNull();
    expect(nearestMealDay(onlyToday, TODAY, "last")).toBeNull();
  });

  it("counts meals whose recipe was deleted (they still show, without a rating)", () => {
    expect(nearestMealDay([meal("gone", "2026-11-18", "dinner", null)], TODAY, "last")).toBe("2026-11-18");
    expect(nearestMealDay([meal("gone", "2026-11-20", "dinner", null)], TODAY, "next")).toBe("2026-11-20");
  });

  it("is null with no meals", () => {
    expect(nearestMealDay([], TODAY, "next")).toBeNull();
    expect(nearestMealDay([], TODAY, "last")).toBeNull();
  });
});

// Replaces lastMealWhen, which said "Yesterday's dinner" with no date: every
// card now shows the day's date, labelled yesterday or tomorrow when it is.
describe("dayLabel", () => {
  it("labels today, yesterday and tomorrow, with their dates", () => {
    expect(dayLabel(TODAY, TODAY)).toBe("Today · Thu, Nov 19");
    expect(dayLabel("2026-11-18", TODAY)).toBe("Yesterday · Wed, Nov 18");
    expect(dayLabel("2026-11-20", TODAY)).toBe("Tomorrow · Fri, Nov 20");
  });

  it("is just the date for other days, either side", () => {
    expect(dayLabel("2026-11-17", TODAY)).toBe("Tue, Nov 17");
    expect(dayLabel("2026-11-23", TODAY)).toBe("Mon, Nov 23");
  });

  it("works across a month end", () => {
    expect(dayLabel("2026-12-01", "2026-11-30")).toBe("Tomorrow · Tue, Dec 1");
  });
});

describe("mealTypeLabel", () => {
  it("names each meal type", () => {
    const types: MealType[] = ["breakfast", "lunch", "dinner"];
    expect(types.map(mealTypeLabel)).toEqual(["Breakfast", "Lunch", "Dinner"]);
  });
});
