import type { WeekStartDay } from "../../../lib/preferences/types";
import { createDateFromIso, getWeekStartIso } from "../../../lib/utils/dates";

const STORAGE_KEY = "planmymeals:meal-plans:view-state";

export type MealPlannerViewState = {
  weekStartIso: string;
};

type ParsedMealPlannerViewState = Partial<MealPlannerViewState>;

const isIsoDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

export const loadMealPlannerViewState = (
  fallback: MealPlannerViewState
): MealPlannerViewState => {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const savedState = window.sessionStorage.getItem(STORAGE_KEY);
    if (!savedState) {
      return fallback;
    }

    const parsedState = JSON.parse(savedState) as ParsedMealPlannerViewState;
    const nextWeekStartIso = isIsoDate(parsedState.weekStartIso ?? "")
      ? parsedState.weekStartIso!
      : fallback.weekStartIso;

    return { weekStartIso: nextWeekStartIso };
  } catch {
    return fallback;
  }
};

export const saveMealPlannerViewState = (state: MealPlannerViewState): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const clearMealPlannerViewState = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(STORAGE_KEY);
};

/** The week the planner opens on when nothing else asks for a specific week:
 *  the last week viewed in this tab, otherwise the current week. The planner
 *  and sign-in prefetching both use this so they load the same week. */
export const getPlannerStartWeek = (weekStartsOn: WeekStartDay, today: Date = new Date()): string => {
  const { weekStartIso } = loadMealPlannerViewState({ weekStartIso: getWeekStartIso(today, weekStartsOn) });
  // Round to the first day of that week (the user may have changed which day
  // weeks start on since), so this always matches the planner's cache keys.
  return getWeekStartIso(createDateFromIso(weekStartIso), weekStartsOn);
};
