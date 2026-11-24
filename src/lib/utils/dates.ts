// Date helpers that work on local-time "YYYY-MM-DD" strings. The first day
// of the week is the user's preference (Sunday or Monday), so anything that
// finds a week's start takes it as `weekStartsOn`.

import type { WeekStartDay } from "../preferences/types";

const monthDayYearFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const monthDayFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

export function createDateFromIso(isoDate: string): Date {
  const [yearPart, monthPart, dayPart] = isoDate.split("-").map(Number);
  return new Date(yearPart, monthPart - 1, dayPart);
}

/** True only for a complete, real "YYYY-MM-DD" date (so not 2026-02-31). */
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return toIsoDate(createDateFromIso(value)) === value;
}

export function addDays(date: Date, dayOffset: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + dayOffset);
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** How far into its week a date is: 0 on the week's first day, 6 on its last. */
export function dayOfWeekIndex(date: Date, weekStartsOn: WeekStartDay): number {
  return (date.getDay() - weekStartsOn + 7) % 7;
}

/** The first day of the week that `referenceDate` is in. */
export function getWeekStartIso(referenceDate: Date, weekStartsOn: WeekStartDay): string {
  return toIsoDate(addDays(referenceDate, -dayOfWeekIndex(referenceDate, weekStartsOn)));
}

export function getWeekEndIso(weekStartIso: string): string {
  return toIsoDate(addDays(createDateFromIso(weekStartIso), 6));
}

export function shiftWeekStartIso(weekStartIso: string, weekOffset: number): string {
  return toIsoDate(addDays(createDateFromIso(weekStartIso), weekOffset * 7));
}

export function formatWeekRangeLabel(weekStartIso: string): string {
  const weekStartDate = createDateFromIso(weekStartIso);
  const weekEndDate = addDays(weekStartDate, 6);
  return `${monthDayYearFormatter.format(weekStartDate)} - ${monthDayYearFormatter.format(weekEndDate)}`;
}

/** Whether `isoDate` falls in the 7 days starting `weekStartIso`. */
export function isInWeek(isoDate: string, weekStartIso: string): boolean {
  return isoDate >= weekStartIso && isoDate <= getWeekEndIso(weekStartIso);
}

/** Two-letter weekday names in week order: Su Mo … Sa, or Mo Tu … Su. */
export function weekdayInitials(weekStartsOn: WeekStartDay): string[] {
  const names = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  return [...names.slice(weekStartsOn), ...names.slice(0, weekStartsOn)];
}

export function formatDateRange(startIso: string, endIso: string): string {
  return `${monthDayYearFormatter.format(createDateFromIso(startIso))} – ${monthDayYearFormatter.format(createDateFromIso(endIso))}`;
}

/** "May 25": a single day, without the year. */
export function formatMonthDay(isoDate: string): string {
  return monthDayFormatter.format(createDateFromIso(isoDate));
}

/** "Nov 3, 2026": the local date of a timestamp ("2026-11-03T18:20:00Z"). */
export function formatTimestampDate(isoTimestamp: string): string {
  return monthDayYearFormatter.format(new Date(isoTimestamp));
}
