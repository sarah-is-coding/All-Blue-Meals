# Testing principles (Vitest + React Testing Library)

Applies to: Vitest 4 (jsdom, globals), `@testing-library/react` 16,
`user-event` 14, and `jest-dom`. Required tests per change type, mocking
recipes, file locations, and the debounce rules are in CLAUDE.md →
Testing. This file covers how to write tests that stay useful.

## 1. Test behavior the way a user sees it

"The more your tests resemble the way your software is used, the more
confidence they can give you." Assert on what's on screen and what the user
can do, not on component state, hook internals, or CSS classes. A refactor
that doesn't change behavior should not break a test.

## 2. Query by role first

Use queries in this order of preference:

1. `getByRole` (with `{ name: … }`): buttons, links, headings, textboxes,
   checkboxes, dialogs
2. `getByLabelText`: form fields
3. `getByPlaceholderText`, `getByText`, `getByDisplayValue`
4. `getByTestId`: last resort, only when nothing user-visible identifies
   the element

If an element can't be found by role and name, that's often an
accessibility bug in the component. Fix the markup rather than adding a
test id.

## 3. Use the right query variant

- `getBy…` when the element must be there now.
- `findBy…` (or `waitFor`) when it appears after async work. Don't wrap
  `getBy` in `waitFor` when `findBy` does the job.
- `queryBy…` only to assert something is **not** there
  (`expect(queryByRole(…)).not.toBeInTheDocument()`).
- Use `screen.*` rather than destructuring from `render` or using
  `container.querySelector`.
- Use jest-dom matchers (`toBeInTheDocument`, `toBeDisabled`,
  `toHaveValue`, `toHaveAccessibleName`) for clear failure messages.

## 4. Interact with `user-event`

- Use `const user = userEvent.setup()` and `await user.click/type(…)`,
  which fires the real sequence of events. Use `fireEvent` only for the
  cases CLAUDE.md calls out (direct `keyDown`).
- Don't wrap things in `act()` yourself. Testing Library already does it;
  an `act` warning usually means a missing `await` or `findBy`.

## 5. Mock at the boundaries, not the internals

- Mock the network boundary: the Supabase client in `api.ts` tests, the
  whole feature `api` module in component tests (CLAUDE.md shows both).
  Don't mock the component's own hooks or child components to make a test
  pass.
- `vi.mock` is hoisted above imports, so a factory can't use variables
  from the test file. Use `vi.hoisted(() => …)` when it needs them.
- Use `vi.mocked(fn)` for typed access to mocks; never cast mocks to `any`.
- Reset mocks between tests (`vi.clearAllMocks()` in `beforeEach`, then
  re-apply chained builder return values). Never let one test's mock setup
  leak into another.
- Mock time only for pure date logic (`vi.setSystemTime`). Don't combine
  fake timers with `waitFor` (CLAUDE.md → Debounced components).

## 6. Each test tells one story

- Name tests by behavior: "shows an error when the recipe fails to save",
  not "test handleSubmit".
- Arrange, act, assert, with one behavior per test. Several assertions are
  fine when they describe the same outcome.
- Build fixture data with small factory helpers that take overrides, so each
  test shows only the fields that matter to it.
- Pure utilities get table-driven tests (`it.each`) covering the happy
  path, empty/null inputs, and edge cases (fractions, unit conversions,
  week boundaries on both week-start days).
- Render through `renderWithProviders` so every test gets a fresh query
  cache and test user, with no state shared between tests.

## 7. A failing test is information

- Don't skip, delete, or loosen a failing test to get green (CLAUDE.md).
  Find out whether the code or the test is wrong.
- When fixing a bug, first write a test that fails because of it, then fix
  the code.
- Flaky tests are bugs. Usually the cause is a missing `await`, a `getBy`
  that should be `findBy`, or state leaking between tests.

## Sources

- [Testing Library: Guiding Principles](https://testing-library.com/docs/guiding-principles)
- [Testing Library: About Queries (priority)](https://testing-library.com/docs/queries/about)
- [Kent C. Dodds: Common mistakes with React Testing Library](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Testing Library: user-event](https://testing-library.com/docs/user-event/intro)
- [Vitest: Mocking guide](https://vitest.dev/guide/mocking)
- [Vitest: vi API (`vi.mock`, `vi.hoisted`, `vi.mocked`)](https://vitest.dev/api/vi)
- [Mergify: Vitest vi.mock hoisting traps](https://mergify.com/blog/vitest-vimock-hoisting-traps)
