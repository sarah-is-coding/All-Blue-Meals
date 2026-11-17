// Date helpers that work on local-time "YYYY-MM-DD" strings. Weeks start
// on Sunday (decision 8 of docs/meal-planning-redesign.md).

const monthDayYearFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

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

export function getWeekStartIso(referenceDate: Date = new Date()): string {
  // getDay() is 0 for Sunday, so it is also the distance back to the week's start.
  return toIsoDate(addDays(referenceDate, -referenceDate.getDay()));
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

export function formatDateRange(startIso: string, endIso: string): string {
  return `${monthDayYearFormatter.format(createDateFromIso(startIso))} – ${monthDayYearFormatter.format(createDateFromIso(endIso))}`;
}
