import { useMemo } from "react";
import {
  createDateFromIso,
  dayOfWeekIndex,
  getWeekStartIso,
  weekdayInitials,
} from "../utils/dates";
import { useUserPreferences } from "./preferencesContext";

/**
 * Weeks as the signed-in user sees them (starting Sunday or Monday). Use this
 * instead of reading the preference: the date helpers it wraps stay pure
 * (src/lib/utils/dates.ts), and components never need the preferences' shape.
 */
export function useWeek() {
  const { weekStartsOn } = useUserPreferences();
  return useMemo(
    () => ({
      /** 0 = Sunday, 1 = Monday; for pure helpers that take it (e.g. getPlannerStartWeek). */
      weekStartsOn,
      /** The first day of the week a date (a Date or "YYYY-MM-DD") is in. */
      startOf: (date: Date | string) =>
        getWeekStartIso(typeof date === "string" ? createDateFromIso(date) : date, weekStartsOn),
      /** The first day of this week. */
      current: () => getWeekStartIso(new Date(), weekStartsOn),
      /** 0 on the week's first day … 6 on its last. */
      dayIndex: (date: Date) => dayOfWeekIndex(date, weekStartsOn),
      /** "Su Mo … Sa" or "Mo Tu … Su", for calendar headers. */
      weekdayInitials: weekdayInitials(weekStartsOn),
    }),
    [weekStartsOn]
  );
}
