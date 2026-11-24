import { useMemo, type ReactNode } from "react";
import { useUserPreferencesQuery } from "../features/preferences/queries";
import { PreferencesContext } from "../lib/preferences/preferencesContext";

/** Loads the signed-in user's preferences and shares them with every page
 *  (read with useUserPreferences / useWeekStartsOn from src/lib/preferences). */
export default function PreferencesProvider({ children }: { children: ReactNode }) {
  const { preferences, ready } = useUserPreferencesQuery();
  const value = useMemo(() => ({ preferences, ready }), [preferences, ready]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}
