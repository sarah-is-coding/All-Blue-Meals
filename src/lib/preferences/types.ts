// The signed-in user's preferences. Shared by several features (meal plans,
// grocery), so the types live in lib; loading and saving them is the
// preferences feature's job.

/** The first day of the week: 0 = Sunday, 1 = Monday (what Date.getDay counts from). */
export type WeekStartDay = 0 | 1;

export type CadenceUnit = "day" | "week" | "month";

/** How much someone usually plans at once: "1 week", "2 weeks", "1 month", "10 days". */
export type PlanningCadence = {
  unit: CadenceUnit;
  count: number;
};

export type UserPreferences = {
  weekStartsOn: WeekStartDay;
  planningCadence: PlanningCadence;
};

/** How the app behaved before preferences existed, and what a new user gets. */
export const DEFAULT_PREFERENCES: UserPreferences = {
  weekStartsOn: 0,
  planningCadence: { unit: "week", count: 1 },
};

/** The most of each unit a cadence can be (the database allows 1–90). */
export const CADENCE_MAX: Record<CadenceUnit, number> = { day: 90, week: 12, month: 3 };
