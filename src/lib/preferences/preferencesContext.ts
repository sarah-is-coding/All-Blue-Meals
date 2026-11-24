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

export function useUserPreferences(): UserPreferences {
  return useContext(PreferencesContext).preferences;
}

/** The first day of the week the user picked (0 = Sunday, 1 = Monday). */
export function useWeekStartsOn() {
  return useContext(PreferencesContext).preferences.weekStartsOn;
}

export function usePreferencesReady(): boolean {
  return useContext(PreferencesContext).ready;
}
