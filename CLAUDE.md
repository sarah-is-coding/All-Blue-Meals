# PlanMyMeals — Claude Agent Guidelines

This file covers the stack, testing, code style, and database workflow.
Product goals and domain rules (RLS ownership patterns, mobile UX, ads,
grocery merge rules) are in AGENTS.md, imported here:

@AGENTS.md

## Stack

- **Frontend**: React 19 + TypeScript (strict), Vite, React Router v7
- **Backend**: Supabase (Postgres + Auth + RLS)
- **Styling**: Plain CSS with CSS variables (no Tailwind in components)
- **Testing**: Vitest + React Testing Library + jsdom

---

## Testing — Non-Negotiable Rules

### Always run tests after implementation

After every code change — no exceptions:

```bash
npm test
```

All tests must pass before considering a task done. If a test fails,
fix the code or the test (see below for which) before finishing.

### Never leave a regression

If your change causes a previously passing test to fail, you have
introduced a regression. Fix it. Do not disable, skip, or delete a test
just to make the suite green — that hides real breakage.

### New feature → new tests

Every new function, component, or API call needs a test. Minimum bar:

- **Pure utility functions**: cover the happy path, null/empty inputs,
  and at least one edge case.
- **API functions** (Supabase calls): mock the client, assert the right
  table/columns/filters are called, and assert the mapped return value.
- **React components**: render check, the main user interaction, and any
  prop-controlled states (e.g. `readOnly`).
- **End-to-end component flows**: for multi-step UI (e.g. the ingredient
  combobox search → add new → pick category flow) write at least one test
  that walks the complete journey.

### Intentional behavior change → update the test

If you deliberately change how something works, update the test to match
the new intended behavior and leave a comment explaining why the behavior
changed. Do not just delete the failing assertion.

---

## Test File Locations

```
src/
  __tests__/
    features/
      ingredients/
        api.test.ts          ← searchIngredients, createIngredient
      recipes/
        utils/
          ingredientScaling.test.ts
          recipeForm.test.ts
        components/
          IngredientNameCombobox.test.tsx
    lib/
      utils/
        dates.test.ts
        quantities.test.ts
    setup.ts                 ← @testing-library/jest-dom import
```

Mirror the `src/features/` and `src/lib/` structure under `src/__tests__/`.

---

## Testing Conventions

### Mocking Supabase

Supabase uses a fluent chainable builder. Use the chainable builder
pattern — every method returns the builder itself, terminal methods
(`.returns()`, `.single()`, `.maybeSingle()`) return a Promise:

```ts
vi.mock("../../../lib/supabaseClient", () => {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};

  const chained = ["from", "select", "upsert", "insert", "update",
                   "delete", "ilike", "eq", "order", "limit", "not",
                   "in", "or", "is", "contains", "gte", "lte", "range"];

  for (const method of chained) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }

  builder.returns      = vi.fn().mockResolvedValue({ data: [], error: null });
  builder.single       = vi.fn().mockResolvedValue({ data: null, error: null });
  builder.maybeSingle  = vi.fn().mockResolvedValue({ data: null, error: null });

  return { supabase: builder };
});
```

Reset with `vi.clearAllMocks()` in `beforeEach` and re-apply
`.mockReturnValue(builder)` on each chained method — `clearAllMocks`
wipes the return values.

### Mocking feature API modules in component tests

Mock the whole module so component tests never touch the network:

```ts
vi.mock("../../../../features/ingredients/api", () => ({
  searchIngredients: vi.fn(),
  createIngredient:  vi.fn(),
}));
```

Then configure return values per-test with `vi.mocked(fn).mockResolvedValue(...)`.

### Debounced components

Do NOT use `vi.useFakeTimers()` with `waitFor` — fake timers block
`waitFor`'s internal polling and cause timeouts. Instead:

- Use `userEvent.setup()` (no `advanceTimers` option)
- Use `waitFor(() => ..., { timeout: 1500 })` — enough to outlast the
  280 ms debounce since mocked API calls resolve instantly
- For direct keydown testing (bypassing focus uncertainty), use
  `fireEvent.keyDown(element, { key: '...' })` instead of
  `user.keyboard(...)`

### Test scripts

| Command | When to use |
|---|---|
| `npm test` | Before finishing any task; must pass |
| `npm run test:watch` | During active development |
| `npm run lint` | Before finishing; must pass |
| `npm run build` | Runs `tsc -b`, which type-checks tests too (Vitest alone does not) |

CI (`.github/workflows/ci.yml`) runs lint, build, and tests on every push
to `main`.

---

## Supabase / Database

- The schema is defined by the migrations in `supabase/migrations/`,
  applied in filename order. There is no separate schema file — the
  migrations are the source of truth, and a fresh database is built by
  running all of them
- Every change goes in a new file named
  `YYYYMMDDHHMMSS_short_description.sql` (`supabase migration new <name>`
  generates one). Never edit a migration that has already been applied
- Apply with `supabase db push` (requires `supabase link` first). If you
  apply one by hand in the Dashboard SQL Editor instead, record it with
  `supabase migration repair --status applied <timestamp>` so the CLI's
  history stays in sync
- `supabase/config.toml` is committed; `supabase/.temp/` is CLI state and
  is not
- RLS is enabled on every table. New tables need policies before the
  app can read or write them
- After a migration is applied, run `npm run db:types` to regenerate
  `src/lib/db/database.types.ts` and commit it with the migration. Never
  edit that file by hand
- Prefer `NOT NULL` for columns the app always sets, so the generated
  types match what the code assumes

## Feature Structure

```
src/features/<feature>/
  types.ts       ← TypeScript types only, no logic
  constants.ts   ← Fixed values (options lists, defaults), if the feature has any
  api.ts         ← All Supabase calls for this feature
  queries.ts     ← TanStack Query keys, hooks, and cache updates (see Data loading)
  components/    ← UI components
  pages/         ← Route-level page components
  utils/         ← Pure helper functions (easiest to test)
  README.md
```

### Data loading (TanStack Query, enforced by ESLint)

Server data is loaded and cached with TanStack Query, always behind our own
modules. Data flows one way:

```
component → features/<feature>/queries.ts → features/<feature>/api.ts → Supabase
```

- `src/lib/query/queryClient.ts` creates the one `QueryClient` and its
  defaults (data is fresh for 60 s; unused data stays cached for 30 min)
- Each feature's `queries.ts` is the only place that feature uses TanStack
  Query. It defines the cache keys (scoped to the signed-in user via
  `useCurrentUserId()`), the hooks components call (e.g.
  `useMealPlanWeek`), and actions that save a change through `api.ts` and
  then update every cached view it affects (e.g. `useMealPlanActions`)
- Components never import `@tanstack/react-query` or build cache keys;
  ESLint only allows the library in `src/lib/query`, `queries.ts` files,
  `src/app/App.tsx`, and `src/app/useSessionCache.ts`
- `src/app/useSessionCache.ts` prefetches in the background when a user
  signs in: the week the planner will open on (`getPlannerStartWeek()`)
  first, then the weeks either side. On sign-out it clears the whole cache
  and the planner's remembered week
- Actions write to the cache only after the database confirms the change,
  and cancel in-flight requests first so a stale response can't overwrite
  the update (see `settleInFlightRequests` in `meal-plans/queries.ts`)
- Changes made elsewhere that affect cached data must invalidate it, e.g.
  deleting a saved plan or editing/deleting a recipe calls
  `useInvalidateMealPlanWeeks()`
- Prefetch the week the user is about to see on its own before its
  neighbours (`prefetchWeekThenNeighbours`, and `useMealPlanWeek` waits for
  the visible week) so it never shares bandwidth with speculative requests
- Tests render with `renderWithProviders` / `renderHookWithProviders` from
  `src/__tests__/utils/renderWithProviders.tsx` (fresh cache + test user)
- Query modules today: `meal-plans/queries.ts` (weeks, date ranges,
  saved plans, previews), `grocery/queries.ts` (saved lists), and
  `recipes/queries.ts` (list pages, recipe detail). Recipe changes also
  refresh planner weeks, since the planner shows recipe titles/servings

### Which meals count (meal plans)

Anything that needs "the meals planned for some dates" must use the shared
functions in `src/features/meal-plans/api.ts` instead of querying
`planned_meals` itself, so the planner, grocery lists, previews, and
copying plans always agree:

- `listPlannedMealsBetween(start, end)`: every meal dated in the range, from
  any plan (dates decide, not plan membership, so this works for plans longer
  than a week). The planner week, grocery ranges, the copy-dates calendar,
  and "Replace existing" use it
- `listSavedPlanMeals(savedPlanId)`: a saved plan's frozen copy of its meals,
  dated from the plan's first day. Saved-plan previews, applying a saved
  plan, and grocery-by-saved-plan use it

### Feature boundaries (enforced by ESLint)

Features may only import from the features listed for them in
`featureDependencies` in `eslint.config.js`. Today that is
`recipes → ingredients, meal-plans` and
`grocery → ingredients, meal-plans`; `auth`, `ingredients`, and
`meal-plans` import no other feature. `src/lib` and `src/components`
must not import from features or `src/app`.

If two features need the same generic helper (dates, quantities, …),
put it in `src/lib/utils/` rather than importing it from another
feature. Only extend `featureDependencies` for a genuine domain
dependency, and never in a way that creates a cycle.

## CSS

- Use existing CSS variables from `src/styles/global.css`
  (`--color-brand`, `--alpha-brand-20`, `--color-muted-soft`, etc.)
- Styles are split by area, imported in cascade order by `src/styles/app.css`:
  `src/styles/features/<feature>.css` for a feature's components,
  `shared.css` for UI used across features (buttons, ads, loading modal,
  form messages), `layout.css` for the app shell, `landing.css` for the
  landing page
- Add a component's styles to its area's file with a BEM-style class prefix
  matching the component name (e.g. `.ingredient-combobox__*`). A new file
  goes in the `app.css` import list, which sets which file wins when two
  equally specific rules style the same element
- No inline styles; no Tailwind utility classes in component files

## Code Style

- TypeScript strict mode — no `any`, no unused variables
- Prefer explicit `type` imports (`import type { ... }`)
- API layer maps snake_case DB rows to camelCase TypeScript types. Derive
  row types from the generated schema
  (`Pick<Tables<"recipes">, "id" | "title">`) rather than hand-writing
  them; only narrow a column (e.g. a CHECK-constrained `meal_type`) with a
  comment saying why
- Form state uses string fields for all inputs (numbers are strings
  until parsed on submit)
- Load data as described in "Data loading" below — never with a
  hand-written `useEffect` + `mounted` flag. Use `useDebouncedValue` for
  search-as-you-type
