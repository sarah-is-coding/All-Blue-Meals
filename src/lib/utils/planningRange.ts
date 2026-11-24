// The dates a planning period covers, from the user's planning cadence
// ("1 week", "2 weeks", "1 month", "10 days"). The meal planner's Calendar tab
// and the grocery page start on this range, and their arrows step by it.
//
// Where a period starts depends on its unit:
// - weeks start on the first day of the week (the user's Sunday or Monday)
// - months start on the 1st
// - days start on the day itself

import type { PlanningCadence, WeekStartDay } from "../preferences/types";
import { addDays, createDateFromIso, getWeekStartIso, toIsoDate } from "./dates";

export type DateRange = { startIso: string; endIso: string };

const lastDayOfMonth = (year: number, month: number): Date => new Date(year, month + 1, 0);

/** The day `months` months after `date`, clamped to that month's length (Jan 31 + 1 month = Feb 28). */
function addMonths(date: Date, months: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = lastDayOfMonth(target.getFullYear(), target.getMonth()).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), lastDay));
}

const isLastDayOfMonth = (date: Date): boolean => addDays(date, 1).getDate() === 1;

/** The planning period that `anchorIso` falls in (e.g. today, or the week shown on the planner). */
export function planningRange(
  cadence: PlanningCadence,
  anchorIso: string,
  weekStartsOn: WeekStartDay
): DateRange {
  const anchor = createDateFromIso(anchorIso);
  const count = Math.max(1, Math.round(cadence.count));

  if (cadence.unit === "month") {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const end = lastDayOfMonth(start.getFullYear(), start.getMonth() + count - 1);
    return { startIso: toIsoDate(start), endIso: toIsoDate(end) };
  }

  const startIso = cadence.unit === "week" ? getWeekStartIso(anchor, weekStartsOn) : anchorIso;
  const days = cadence.unit === "week" ? count * 7 : count;
  return { startIso, endIso: toIsoDate(addDays(createDateFromIso(startIso), days - 1)) };
}

/**
 * The range moved by one planning period, back (-1) or forward (1). Days and
 * weeks move by their length; months move by calendar months, keeping a range
 * that ends on a month's last day ending on the last day of the new month.
 */
export function shiftByCadence(range: DateRange, cadence: PlanningCadence, direction: 1 | -1): DateRange {
  const count = Math.max(1, Math.round(cadence.count));
  const start = createDateFromIso(range.startIso);
  const end = createDateFromIso(range.endIso);

  if (cadence.unit === "month") {
    const months = count * direction;
    const shiftedEnd = isLastDayOfMonth(end)
      ? lastDayOfMonth(end.getFullYear(), end.getMonth() + months)
      : addMonths(end, months);
    return { startIso: toIsoDate(addMonths(start, months)), endIso: toIsoDate(shiftedEnd) };
  }

  const days = (cadence.unit === "week" ? count * 7 : count) * direction;
  return { startIso: toIsoDate(addDays(start, days)), endIso: toIsoDate(addDays(end, days)) };
}

const UNIT_NAMES: Record<PlanningCadence["unit"], [string, string]> = {
  day: ["day", "days"],
  week: ["week", "weeks"],
  month: ["month", "months"],
};

/** "a week", "2 weeks", "a month", "10 days": for labels like "Move dates back 2 weeks". */
export function describeCadence(cadence: PlanningCadence): string {
  const [one, many] = UNIT_NAMES[cadence.unit];
  return cadence.count === 1 ? `a ${one}` : `${cadence.count} ${many}`;
}
