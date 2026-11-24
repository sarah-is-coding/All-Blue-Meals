# TanStack Query principles

Applies to: `@tanstack/react-query` v5. The project rules (where the library
may be imported, how data flows, prefetching, invalidation) are in
CLAUDE.md → Data loading. This file covers how to use the library well
inside those rules.

## 1. TanStack Query owns server state

- Data that lives in Supabase is server state: cached, shared, possibly
  stale. Read it through a `queries.ts` hook, never copy it into `useState`
  or context (except to start an editable form draft).
- Don't use the query cache as a global store for client-only UI state
  (open panels, form inputs). That's `useState`/context.

## 2. Query keys are dependency arrays

- Every variable the `queryFn` uses must be in the key: the user id, ids,
  date ranges, search text, and filters. If it isn't, two different requests
  share one cache entry.
- Build keys with a key factory per feature, ordered from general to
  specific, so invalidation can target a whole branch:

  ```ts
  const recipeKeys = {
    all: (userId: string) => ["recipes", userId] as const,
    lists: (userId: string) => [...recipeKeys.all(userId), "list"] as const,
    detail: (userId: string, id: string) => [...recipeKeys.all(userId), "detail", id] as const,
  };
  ```

- Keys and `queryFn` live together. Prefer `queryOptions({ queryKey,
  queryFn, ... })` so the same definition is reused by `useQuery`,
  `prefetchQuery`, and `getQueryData` with full type inference.
- Keys must be serializable. Use ISO date strings, not `Date` objects.

## 3. Keep `queryFn` thin

- `queryFn` calls a function from `api.ts` and returns its result. Mapping
  snake_case rows to camelCase happens in `api.ts`, not in the hook.
- `api.ts` functions throw on `error` so the query enters its error state.
  A `queryFn` must never resolve with `undefined` (v5 treats it as an error).
- Pass the `signal` from the query context through to Supabase
  (`.abortSignal(signal)`) when a request can be superseded, such as search
  as you type.

## 4. Use `select` to derive, not a second query

Transform or pick from cached data with the `select` option (or a pure util
applied in the component) instead of a new request or a `useEffect` that
copies data into state. `select` re-runs only when the data or the selector
changes; keep the selector stable (module-level function or `useCallback`).

## 5. Mutations: confirm, then update every affected view

- Follow the repo's pattern: cancel in-flight queries that could overwrite
  the change, save through `api.ts`, then write the confirmed result into
  each cached view it affects, or invalidate those keys.
- Prefer invalidation when the effect on cached data is hard to compute
  exactly. Prefer `setQueryData` when you already have the confirmed row and
  refetching would be wasteful (free-tier bandwidth).
- Optimistic updates are allowed for fast, low-risk toggles (grocery
  check/uncheck, per AGENTS.md). Snapshot the previous data in `onMutate`,
  roll back in `onError`, and invalidate in `onSettled`.
- Never mutate cached data in place. `setQueryData` takes a new object.

## 6. Loading and error states are part of the hook's contract

- Distinguish `isPending` (no data yet) from `isFetching` (background
  refetch). Show `LoadingModal`/skeletons only for the first; don't blank out
  data the user can already see during a background refetch.
- Use `placeholderData: keepPreviousData` for paginated or week-to-week
  views, so the old page stays visible while the next one loads.
- Every screen handles empty, error, and success explicitly (AGENTS.md →
  Definition of done). Show friendly messages, not raw Supabase errors.

## 7. Tune caching deliberately

- The global defaults (`staleTime` 60 s, `gcTime` 30 min) live in
  `src/lib/query/queryClient.ts`. Override per query only with a reason
  (for example, the ingredient catalog barely changes, so a longer
  `staleTime` is fine), and write the reason in a comment.
- Retries are for network failures. Don't retry errors that won't change
  (permission denied, validation).

## Sources

- [TanStack Query v5 docs: Query Keys](https://tanstack.com/query/v5/docs/framework/react/guides/query-keys)
- [TanStack Query v5 docs: Query Options](https://tanstack.com/query/v5/docs/framework/react/guides/query-options)
- [TanStack Query v5 docs: Optimistic Updates](https://tanstack.com/query/v5/docs/framework/react/guides/optimistic-updates)
- [TkDodo's blog index (maintainer guidance)](https://tanstack.com/query/v5/docs/react/community/tkdodos-blog)
- [TkDodo: Effective React Query Keys](https://tkdodo.eu/blog/effective-react-query-keys)
- [Telerik: Query key patterns for scaling TanStack Query](https://www.telerik.com/blogs/query-keys-patterns-scaling-tanstack-query)
