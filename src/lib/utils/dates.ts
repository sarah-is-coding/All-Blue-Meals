// Date helpers that work on local-time "YYYY-MM-DD" strings. Weeks start
// on Monday.

const monthDayYearFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function createDateFromIso(isoDate: string): Date {
  const [yearPart, monthPart, dayPart] = isoDate.split("-").map(Number);
  return new Date(yearPart, monthPart - 1, dayPart);
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
  const day = referenceDate.getDay();
  const offsetToMonday = day === 0 ? -6 : 1 - day;
  return toIsoDate(addDays(referenceDate, offsetToMonday));
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
