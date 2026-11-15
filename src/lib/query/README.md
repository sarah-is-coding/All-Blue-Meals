# Query Client

The app's single TanStack Query client (`queryClient.ts`) and its defaults:

- `STALE_TIME_MS` (60 s): cached data is used without refetching for this long; after that it still shows instantly while refreshing in the background.
- `GC_TIME_MS` (30 min): how long data nobody is viewing stays in memory, so weeks prefetched at sign-in are still there when the planner opens.

Features don't use TanStack Query directly in components — each feature's `queries.ts` wraps it (see "Data loading" in `CLAUDE.md`). The cache is cleared on sign-out by `src/app/useSessionCache.ts`.
