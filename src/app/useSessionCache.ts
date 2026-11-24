import { useEffect, useRef } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { prefetchWeekThenNeighbours } from "../features/meal-plans/queries";
import { fetchUserPreferences } from "../features/preferences/queries";
import {
  clearMealPlannerViewState,
  getPlannerStartWeek,
} from "../features/meal-plans/utils/mealPlannerViewState";

/**
 * Ties cached data to the signed-in user:
 * - When a user signs in (or the app opens with a saved session), load their
 *   preferences (tiny, and needed to know which day weeks start on), then
 *   prefetch the week the planner will open on, then the weeks either side,
 *   in the background. Nothing waits on the weeks; the planner just opens instantly.
 * - When the user signs out or changes, clear the whole cache and the planner's
 *   remembered week, so nothing from one account carries over to the next.
 */
export function useSessionCache(userId: string | null, client: QueryClient): void {
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    const previous = previousUserId.current;
    previousUserId.current = userId;

    if (previous !== null && previous !== userId) {
      client.clear();
      clearMealPlannerViewState();
    }
    if (userId !== null && userId !== previous) {
      void (async () => {
        const { weekStartsOn } = await fetchUserPreferences(client, userId);
        await prefetchWeekThenNeighbours(client, userId, getPlannerStartWeek(weekStartsOn));
      })();
    }
  }, [userId, client]);
}
