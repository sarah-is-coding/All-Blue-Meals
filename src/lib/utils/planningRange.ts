// The dates a planning period covers, from the user's planning cadence
// ("1 week", "2 weeks", "1 month", "10 days"). The meal planner's Calendar tab
// and the grocery page start on one, and their arrows step by it.
//
// - planningRange: the calendar-aligned period a day falls in (the grocery
//   page: this week, or this month from the 1st)
// - planningRangeFrom: one period starting on a given day (the planner's
//   Calendar tab, which starts on the viewed week: copying goes into that
//   week, so its default must never overlap it from an earlier start)

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

/** The last day of `months` months starting on `start`: the day before the
 *  same date that many months later (Nov 22 → Dec 21), or, when that month is
 *  too short to have the date, its last day (May 31 → Jun 30, Jan 31 → Feb 28). */
function endOfMonths(start: Date, months: number): Date {
  const targetLastDay = lastDayOfMonth(start.getFullYear(), start.getMonth() + months);
  return start.getDate() > targetLastDay.getDate()
    ? targetLastDay
    : addDays(new Date(start.getFullYear(), start.getMonth() + months, start.getDate()), -1);
}

/** One planning period starting on `startIso`: 7 × n days, n days, or n months. */
export function planningRangeFrom(cadence: PlanningCadence, startIso: string): DateRange {
  const start = createDateFromIso(startIso);
  const count = Math.max(1, Math.round(cadence.count));
  const end =
    cadence.unit === "month"
      ? endOfMonths(start, count)
      : addDays(start, (cadence.unit === "week" ? count * 7 : count) - 1);
  return { startIso, endIso: toIsoDate(end) };
}

/** The calendar-aligned planning period that `anchorIso` falls in: weeks
 *  start on the user's first day of the week, months on the 1st, days on the
 *  day itself. */
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
  return planningRangeFrom({ unit: cadence.unit, count }, startIso);
}

/**
 * The range moved by one planning period, back (-1) or forward (1). Days and
 * weeks move by their length. For months:
 * - a range that is exactly one planning period (Nov 1–30, Nov 22–Dec 21,
 *   Jan 31–Feb 28) steps to the next or previous one, touching it with no
 *   gap or overlap
 * - any other range moves both ends by calendar months, keeping an end on a
 *   month's last day on the last day of the new month
 */
export function shiftByCadence(range: DateRange, cadence: PlanningCadence, direction: 1 | -1): DateRange {
  const count = Math.max(1, Math.round(cadence.count));
  const start = createDateFromIso(range.startIso);
  const end = createDateFromIso(range.endIso);

  if (cadence.unit === "month") {
    if (toIsoDate(endOfMonths(start, count)) === range.endIso) {
      if (direction === 1) return planningRangeFrom(cadence, toIsoDate(addDays(end, 1)));
      return { startIso: toIsoDate(addMonths(start, -count)), endIso: toIsoDate(addDays(start, -1)) };
    }
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
