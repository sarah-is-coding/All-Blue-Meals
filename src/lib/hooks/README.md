# Shared Hooks

Generic React hooks used by more than one feature. Server data is loaded with TanStack Query through each feature's `queries.ts`, not here (see "Data loading" in `CLAUDE.md`). Like `src/lib/utils`, code here must not import from `src/features` or `src/app`.

- `useDebouncedValue.ts` — debounce a changing value (e.g. a search box)

Tests live in `src/__tests__/lib/hooks/`.
