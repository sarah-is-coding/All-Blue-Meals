import { useMemo } from "react";
import {
  describeCadence,
  planningRange,
  planningRangeFrom,
  shiftByCadence,
  type DateRange,
} from "../utils/planningRange";
import { useUserPreferences } from "./preferencesContext";

/**
 * The signed-in user's planning period (how often they plan: a week, 2 weeks,
 * a month…), with the date helpers already applied to it. Use this instead of
 * reading the preference; the helpers it wraps stay pure
 * (src/lib/utils/planningRange.ts).
 */
export function usePlanningPeriod() {
  const { planningCadence, weekStartsOn } = useUserPreferences();
  return useMemo(
    () => ({
      /** The calendar-aligned period a day is in: its week(s), or its month(s) from the 1st. */
      around: (dateIso: string) => planningRange(planningCadence, dateIso, weekStartsOn),
      /** One period starting exactly on a day (e.g. the week shown on the planner). */
      from: (startIso: string) => planningRangeFrom(planningCadence, startIso),
      /** A range moved one period back (-1) or forward (1). */
      shift: (range: DateRange, direction: 1 | -1) => shiftByCadence(range, planningCadence, direction),
      /** "a week", "2 weeks", "a month": for labels like "Move dates back 2 weeks". */
      label: describeCadence(planningCadence),
    }),
    [planningCadence, weekStartsOn]
  );
}
