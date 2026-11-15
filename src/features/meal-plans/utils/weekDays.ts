import { addDays, createDateFromIso, toIsoDate } from "../../../lib/utils/dates";
import type { MealPlannerDay } from "../types";

const weekdayShortFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
});
const monthDayFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});
const fullDateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
});

export function getWeekDays(weekStartIso: string): MealPlannerDay[] {
  const weekStartDate = createDateFromIso(weekStartIso);

  return Array.from({ length: 7 }, (_, index) => {
    const currentDate = addDays(weekStartDate, index);
    return {
      dateIso: toIsoDate(currentDate),
      weekdayShort: weekdayShortFormatter.format(currentDate),
      monthDayLabel: monthDayFormatter.format(currentDate),
      fullLabel: fullDateFormatter.format(currentDate),
    };
  });
}
