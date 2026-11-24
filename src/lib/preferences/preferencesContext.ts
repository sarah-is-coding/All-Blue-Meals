import { createContext, useContext } from "react";
import { DEFAULT_PREFERENCES, type UserPreferences } from "./types";

type PreferencesContextValue = {
  preferences: UserPreferences;
  /** False while the signed-in user's preferences are first loading. */
  ready: boolean;
};

/**
 * The signed-in user's preferences, provided by src/app/PreferencesProvider.tsx.
 * Without a provider (e.g. in tests) it's the defaults, already ready.
 */
export const PreferencesContext = createContext<PreferencesContextValue>({
  preferences: DEFAULT_PREFERENCES,
  ready: true,
});

/**
 * All of the user's preferences. Components shouldn't need this: read them
 * through a hook named for what they're for (useWeek, usePlanningPeriod), so
 * a component never depends on the preferences' shape and new preferences
 * don't touch it. Add a hook like those for each new kind of preference.
 */
export function useUserPreferences(): UserPreferences {
  return useContext(PreferencesContext).preferences;
}

export function usePreferencesReady(): boolean {
  return useContext(PreferencesContext).ready;
}
