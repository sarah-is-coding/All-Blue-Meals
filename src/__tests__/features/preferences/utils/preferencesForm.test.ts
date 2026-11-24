import {
  parsePreferencesForm,
  samePreferences,
  toPreferencesFormValues,
  type PreferencesFormValues,
} from "../../../../features/preferences/utils/preferencesForm";
import { DEFAULT_PREFERENCES } from "../../../../lib/preferences/types";

const form = (overrides: Partial<PreferencesFormValues> = {}): PreferencesFormValues => ({
  weekStartsOn: "0",
  cadenceChoice: "week-1",
  customCount: "1",
  customUnit: "week",
  ...overrides,
});

describe("toPreferencesFormValues", () => {
  it("picks the matching quick choice", () => {
    expect(toPreferencesFormValues(DEFAULT_PREFERENCES)).toEqual(form());
    expect(
      toPreferencesFormValues({ weekStartsOn: 1, planningCadence: { unit: "week", count: 2 } })
    ).toEqual(form({ weekStartsOn: "1", cadenceChoice: "week-2", customCount: "2" }));
    expect(toPreferencesFormValues({ weekStartsOn: 0, planningCadence: { unit: "month", count: 1 } }).cadenceChoice).toBe(
      "month-1"
    );
  });

  it("is custom for anything else", () => {
    expect(toPreferencesFormValues({ weekStartsOn: 0, planningCadence: { unit: "day", count: 10 } })).toEqual(
      form({ cadenceChoice: "custom", customCount: "10", customUnit: "day" })
    );
  });
});

describe("parsePreferencesForm", () => {
  it("reads a quick choice, ignoring the custom fields", () => {
    expect(parsePreferencesForm(form({ cadenceChoice: "month-1", customCount: "oops" }))).toEqual({
      preferences: { weekStartsOn: 0, planningCadence: { unit: "month", count: 1 } },
      error: null,
    });
  });

  it("reads a custom cadence and the week start", () => {
    expect(
      parsePreferencesForm(form({ weekStartsOn: "1", cadenceChoice: "custom", customCount: " 3 ", customUnit: "week" }))
    ).toEqual({ preferences: { weekStartsOn: 1, planningCadence: { unit: "week", count: 3 } }, error: null });
  });

  it("explains a custom count that's empty, not whole, or out of range for its unit", () => {
    for (const customCount of ["", "0", "2.5", "abc", "-1"]) {
      expect(parsePreferencesForm(form({ cadenceChoice: "custom", customCount, customUnit: "day" })).error).toBe(
        "Enter a whole number from 1 to 90 days."
      );
    }
    expect(parsePreferencesForm(form({ cadenceChoice: "custom", customCount: "4", customUnit: "month" })).error).toBe(
      "Enter a whole number from 1 to 3 months."
    );
  });
});

describe("samePreferences", () => {
  it("compares every preference", () => {
    expect(samePreferences(DEFAULT_PREFERENCES, { weekStartsOn: 0, planningCadence: { unit: "week", count: 1 } })).toBe(
      true
    );
    expect(samePreferences(DEFAULT_PREFERENCES, { ...DEFAULT_PREFERENCES, weekStartsOn: 1 })).toBe(false);
    expect(
      samePreferences(DEFAULT_PREFERENCES, { ...DEFAULT_PREFERENCES, planningCadence: { unit: "day", count: 7 } })
    ).toBe(false);
  });
});
