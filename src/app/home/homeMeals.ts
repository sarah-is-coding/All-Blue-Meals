// Which planned meals the home page shows: today's and tomorrow's, and the
// last one before today (to rate and leave a note on). Pure, so it's easy to test.

import { MEAL_TYPE_OPTIONS } from "../../features/meal-plans/constants";
import type { MealType, PlannedMeal } from "../../features/meal-plans/types";
import { addDays, createDateFromIso, toIsoDate } from "../../lib/utils/dates";

const MEAL_ORDER: Record<MealType, number> = { breakfast: 0, lunch: 1, dinner: 2 };

const byTimeOfDay = (a: PlannedMeal, b: PlannedMeal) => MEAL_ORDER[a.mealType] - MEAL_ORDER[b.mealType];

/** The meals planned for one day (e.g. today, tomorrow), breakfast first. */
export function mealsOn(meals: ReadonlyArray<PlannedMeal>, dayIso: string): PlannedMeal[] {
  return meals.filter((meal) => meal.plannedFor === dayIso).sort(byTimeOfDay);
}

/**
 * The most recent meal before today that still has its recipe (a deleted
 * recipe can't be rated): the latest day, and that day's last meal (dinner
 * after lunch after breakfast). Null when there's none.
 */
export function lastMealBefore(meals: ReadonlyArray<PlannedMeal>, todayIso: string): PlannedMeal | null {
  let last: PlannedMeal | null = null;
  for (const meal of meals) {
    if (!meal.recipeId || meal.plannedFor >= todayIso) continue;
    const later =
      !last || meal.plannedFor > last.plannedFor || (meal.plannedFor === last.plannedFor && byTimeOfDay(meal, last) > 0);
    if (later) last = meal;
  }
  return last;
}

const dayFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });

/** "Yesterday's dinner", or "Tue, Nov 17 · Dinner" for an earlier day. */
export const lastMealWhen = (meal: PlannedMeal, todayIso: string): string => {
  const mealType = MEAL_TYPE_OPTIONS.find((option) => option.value === meal.mealType)?.label ?? meal.mealType;
  const yesterday = toIsoDate(addDays(createDateFromIso(todayIso), -1));
  return meal.plannedFor === yesterday
    ? `Yesterday's ${mealType.toLowerCase()}`
    : `${dayFormatter.format(createDateFromIso(meal.plannedFor))} · ${mealType}`;
};
