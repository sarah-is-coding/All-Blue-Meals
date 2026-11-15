import { QueryClient } from "@tanstack/react-query";

/** How long loaded data counts as fresh. Within this window, revisiting a page
 *  uses the cache without refetching; after it, the cached data still shows
 *  instantly while a background refetch picks up changes (e.g. from another
 *  device). */
export const STALE_TIME_MS = 60 * 1000;

/** How long data nobody is currently viewing stays in memory. Long enough that
 *  weeks prefetched at sign-in are still there when the user opens the planner. */
export const GC_TIME_MS = 30 * 60 * 1000;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME_MS,
        gcTime: GC_TIME_MS,
        retry: 1,
      },
    },
  });
}

/** The app's single cache. Cleared on sign-out (see src/app/useSessionCache.ts). */
export const queryClient = createQueryClient();
