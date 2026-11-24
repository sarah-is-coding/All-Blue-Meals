// Loading and saving the signed-in user's preferences, stored on their
// profiles row (RLS: only their own). A user who has never saved any has no
// row yet, which means the defaults.

import type { Tables } from "../../lib/db/database.types";
import {
  CADENCE_MAX,
  DEFAULT_PREFERENCES,
  type CadenceUnit,
  type UserPreferences,
  type WeekStartDay,
} from "../../lib/preferences/types";
import { supabase } from "../../lib/supabaseClient";

type PreferencesRow = Pick<Tables<"profiles">, "week_starts_on" | "plan_cadence_unit" | "plan_cadence_count">;

const PREFERENCE_COLUMNS = "week_starts_on,plan_cadence_unit,plan_cadence_count";

const CADENCE_UNITS: ReadonlyArray<CadenceUnit> = ["day", "week", "month"];

// What people see when loading or saving fails. The database's own message
// (e.g. "column profiles.week_starts_on does not exist") means nothing to them,
// so it's kept only as the error's `cause`.
export const LOAD_PREFERENCES_ERROR = "Couldn't load your preferences.";
export const SAVE_PREFERENCES_ERROR = "Couldn't save your preferences. Check your connection and try again.";

// The columns are CHECK-constrained (0/1, day/week/month, 1–90), which the
// generated types can't express; anything unexpected falls back to the default.
const mapPreferencesRow = (row: PreferencesRow): UserPreferences => {
  const unit = CADENCE_UNITS.find((known) => known === row.plan_cadence_unit);
  const count = Math.round(row.plan_cadence_count);
  return {
    weekStartsOn: row.week_starts_on === 1 ? 1 : (0 satisfies WeekStartDay),
    planningCadence:
      unit && count >= 1 && count <= CADENCE_MAX[unit]
        ? { unit, count }
        : DEFAULT_PREFERENCES.planningCadence,
  };
};

export async function getUserPreferences(userId: string): Promise<UserPreferences> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PREFERENCE_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle<PreferencesRow>();
  if (error) throw new Error(LOAD_PREFERENCES_ERROR, { cause: error });
  return data ? mapPreferencesRow(data) : DEFAULT_PREFERENCES;
}

export async function saveUserPreferences(userId: string, preferences: UserPreferences): Promise<UserPreferences> {
  const { unit, count } = preferences.planningCadence;
  if (!Number.isInteger(count) || count < 1 || count > CADENCE_MAX[unit]) {
    throw new Error(`Choose between 1 and ${CADENCE_MAX[unit]} ${unit}s.`);
  }
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        user_id: userId,
        week_starts_on: preferences.weekStartsOn,
        plan_cadence_unit: unit,
        plan_cadence_count: count,
      },
      { onConflict: "user_id" }
    )
    .select(PREFERENCE_COLUMNS)
    .single<PreferencesRow>();
  if (error) throw new Error(SAVE_PREFERENCES_ERROR, { cause: error });
  if (!data) throw new Error(SAVE_PREFERENCES_ERROR);
  return mapPreferencesRow(data);
}
