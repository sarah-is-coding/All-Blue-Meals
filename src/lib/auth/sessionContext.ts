import { createContext, useContext } from "react";

/** The signed-in user's id, provided by src/app/App.tsx. Query hooks include it
 *  in their cache keys so one user's cached data can never be shown to another. */
export const CurrentUserIdContext = createContext<string | null>(null);

export function useCurrentUserId(): string | null {
  return useContext(CurrentUserIdContext);
}
