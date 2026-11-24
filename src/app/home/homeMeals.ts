// Which planned meals the home page shows: today's, and the nearest day with
// meals after today and before today (that one's to rate and leave notes on),
// with labels for when they are. Pure, so it's easy to test.

import { MEAL_TYPE_OPTIONS } from "../../features/meal-plans/constants";
import type { MealType, PlannedMeal } from "../../features/meal-plans/types";
import { addDays, createDateFromIso, toIsoDate } from "../../lib/utils/dates";

const MEAL_ORDER: Record<MealType, number> = { breakfast: 0, lunch: 1, dinner: 2 };

const byTimeOfDay = (a: PlannedMeal, b: PlannedMeal) => MEAL_ORDER[a.mealType] - MEAL_ORDER[b.mealType];

/** The meals planned for one day (e.g. today), breakfast first. */
export function mealsOn(meals: ReadonlyArray<PlannedMeal>, dayIso: string): PlannedMeal[] {
  return meals.filter((meal) => meal.plannedFor === dayIso).sort(byTimeOfDay);
}

/**
 * The nearest day with a meal planned after today ("next": tomorrow or later)
 * or before it ("last": yesterday or earlier), or null when there's none.
 */
export function nearestMealDay(
  meals: ReadonlyArray<PlannedMeal>,
  todayIso: string,
  direction: "next" | "last"
): string | null {
  let nearest: string | null = null;
  for (const { plannedFor: day } of meals) {
    const onSide = direction === "next" ? day > todayIso : day < todayIso;
    const nearer = nearest === null || (direction === "next" ? day < nearest : day > nearest);
    if (onSide && nearer) nearest = day;
  }
  return nearest;
}

/** "Breakfast", "Lunch", "Dinner". */
export const mealTypeLabel = (mealType: MealType): string =>
  MEAL_TYPE_OPTIONS.find((option) => option.value === mealType)?.label ?? mealType;

const dayFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });

/** When a day is, the same way on every home card: "Today · Mon, Nov 23",
 *  "Yesterday · Sun, Nov 22", "Tomorrow · Tue, Nov 24", or "Thu, Nov 26". */
export function dayLabel(dateIso: string, todayIso: string): string {
  const today = createDateFromIso(todayIso);
  const date = dayFormatter.format(createDateFromIso(dateIso));
  if (dateIso === todayIso) return `Today · ${date}`;
  if (dateIso === toIsoDate(addDays(today, -1))) return `Yesterday · ${date}`;
  if (dateIso === toIsoDate(addDays(today, 1))) return `Tomorrow · ${date}`;
  return date;
}
