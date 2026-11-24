// The Preferences form: string fields while editing, parsed on save.

import { CADENCE_MAX, type CadenceUnit, type PlanningCadence, type UserPreferences } from "../../../lib/preferences/types";

/** The quick choices; anything else is "custom" (a number and a unit). */
export const CADENCE_PRESETS = [
  { value: "week-1", label: "Every week", cadence: { unit: "week", count: 1 } },
  { value: "week-2", label: "Every 2 weeks", cadence: { unit: "week", count: 2 } },
  { value: "month-1", label: "Every month", cadence: { unit: "month", count: 1 } },
] as const satisfies ReadonlyArray<{ value: string; label: string; cadence: PlanningCadence }>;

export type CadenceChoice = (typeof CADENCE_PRESETS)[number]["value"] | "custom";

export const CADENCE_UNIT_OPTIONS: ReadonlyArray<{ value: CadenceUnit; label: string }> = [
  { value: "day", label: "days" },
  { value: "week", label: "weeks" },
  { value: "month", label: "months" },
];

export type PreferencesFormValues = {
  weekStartsOn: "0" | "1";
  cadenceChoice: CadenceChoice;
  /** The custom cadence, kept while a preset is picked so switching back restores it. */
  customCount: string;
  customUnit: CadenceUnit;
};

const presetFor = (cadence: PlanningCadence) =>
  CADENCE_PRESETS.find((preset) => preset.cadence.unit === cadence.unit && preset.cadence.count === cadence.count);

export function toPreferencesFormValues(preferences: UserPreferences): PreferencesFormValues {
  const { planningCadence } = preferences;
  return {
    weekStartsOn: preferences.weekStartsOn === 1 ? "1" : "0",
    cadenceChoice: presetFor(planningCadence)?.value ?? "custom",
    customCount: String(planningCadence.count),
    customUnit: planningCadence.unit,
  };
}

export type ParsedPreferences = { preferences: UserPreferences; error: null } | { preferences: null; error: string };

/** The preferences the form describes, or what's wrong with the custom cadence. */
export function parsePreferencesForm(values: PreferencesFormValues): ParsedPreferences {
  const weekStartsOn = values.weekStartsOn === "1" ? 1 : 0;
  const preset = CADENCE_PRESETS.find((option) => option.value === values.cadenceChoice);
  if (preset) {
    return { preferences: { weekStartsOn, planningCadence: { ...preset.cadence } }, error: null };
  }

  const max = CADENCE_MAX[values.customUnit];
  const unitLabel = CADENCE_UNIT_OPTIONS.find((option) => option.value === values.customUnit)?.label ?? values.customUnit;
  const trimmed = values.customCount.trim();
  const count = /^\d+$/.test(trimmed) ? Number(trimmed) : NaN;
  if (!Number.isInteger(count) || count < 1 || count > max) {
    return { preferences: null, error: `Enter a whole number from 1 to ${max} ${unitLabel}.` };
  }
  return { preferences: { weekStartsOn, planningCadence: { unit: values.customUnit, count } }, error: null };
}

export const samePreferences = (a: UserPreferences, b: UserPreferences): boolean =>
  a.weekStartsOn === b.weekStartsOn &&
  a.planningCadence.unit === b.planningCadence.unit &&
  a.planningCadence.count === b.planningCadence.count;
