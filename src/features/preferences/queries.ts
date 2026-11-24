import { useMemo } from "react";
import { queryOptions, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCurrentUserId } from "../../lib/auth/sessionContext";
import { DEFAULT_PREFERENCES, type UserPreferences } from "../../lib/preferences/types";
import { getUserPreferences, saveUserPreferences } from "./api";

// The only module in preferences that talks to TanStack Query. The app shell
// loads preferences once and shares them through PreferencesContext
// (src/lib/preferences), so other features read them without importing this.

export const preferencesKeys = {
  all: ["preferences"] as const,
  user: (userId: string) => [...preferencesKeys.all, userId] as const,
};

const preferencesQuery = (userId: string) =>
  queryOptions({
    queryKey: preferencesKeys.user(userId),
    queryFn: () => getUserPreferences(userId),
  });

/** The user's preferences, loaded if they aren't cached yet; the defaults if
 *  they can't be loaded (so sign-in prefetching never waits on an error). */
export async function fetchUserPreferences(client: QueryClient, userId: string): Promise<UserPreferences> {
  try {
    return await client.fetchQuery(preferencesQuery(userId));
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/** The signed-in user's preferences. `ready` is false only while they first
 *  load; if loading fails the app carries on with the defaults. */
export function useUserPreferencesQuery() {
  const userId = useCurrentUserId();
  const query = useQuery({ ...preferencesQuery(userId ?? ""), enabled: userId !== null });
  return {
    preferences: query.data ?? DEFAULT_PREFERENCES,
    ready: userId === null || !query.isPending || query.isError,
    error: query.error ? query.error.message || "Failed to load your preferences." : null,
  };
}

/** Saving preferences: saves first, then updates the cached copy, so every
 *  page reading them (through PreferencesContext) changes at once. */
export function usePreferencesActions() {
  const client = useQueryClient();
  const userId = useCurrentUserId();

  return useMemo(
    () => ({
      async save(preferences: UserPreferences): Promise<UserPreferences> {
        if (!userId) throw new Error("Sign in to save your preferences.");
        const saved = await saveUserPreferences(userId, preferences);
        const queryKey = preferencesKeys.user(userId);
        await client.cancelQueries({ queryKey });
        client.setQueryData(queryKey, saved);
        return saved;
      },
    }),
    [client, userId]
  );
}
