# React Router principles

Applies to: `react-router-dom` v7 in **declarative mode**
(`<BrowserRouter>` / `<Routes>` / `<Route>` in `src/app/AppRouter.tsx`).
Data loading is TanStack Query's job, not the router's.

## 1. Stay in declarative mode unless there's a reason to move

React Router v7's modes are additive: declarative → data
(`createBrowserRouter`, loaders, actions) → framework. This app loads data
through TanStack Query and has no route loaders, so declarative mode is the
right fit. Don't add `loader`/`action` to individual routes. Switching modes
is an architectural decision for the whole app, not a per-feature one.

## 2. The URL is state: put shareable state in it

- Anything a user would expect to survive a reload, a back button, or a
  shared link (selected week, search text, tab, filter) belongs in the path
  or search params (`useSearchParams`), not in `useState`.
- Use path params for identity (`/recipes/:id`) and search params for view
  options (`?q=`, `?week=`).
- Treat params as untrusted strings: parse and validate them (an id that
  doesn't exist, a malformed date) and show a friendly not-found or fallback
  state.

## 3. Navigate with links, redirect with `<Navigate>`

- Use `<Link>`/`<NavLink>` for anything the user clicks to go somewhere, so
  it's a real anchor (middle-click, long-press, and screen readers work).
  Use `useNavigate()` only after an action finishes (saved → go to detail).
- Use `<Navigate replace>` for redirects that happen during render (auth
  gates, legacy paths), as `AppRouter` does, so the redirect source doesn't
  stay in history.
- Pass `replace` when the user shouldn't come back to the page with Back
  (after creating a record, after sign-in).
- Pass context between pages with `location.state` only for optional extras
  (like "return to Home"). The destination must still work without it.

## 4. Keep route definitions in one place

- All routes are declared in `src/app/AppRouter.tsx`. Features export page
  components from `pages/` and don't declare their own `<Routes>` trees.
- Use layout routes (`<Route element={<Layout />}>` with `<Outlet />`) for
  shared shells, instead of wrapping each page by hand.
- Always have a catch-all (`path="*"`) route with a friendly not-found page
  or redirect.

## 5. Code-split routes when bundle size calls for it

In declarative mode, split with `React.lazy(() => import("…/SomePage"))` and
a `<Suspense>` boundary around the routes. Split large, rarely visited pages
first. Keep the fallback consistent with `LoadingModal`'s timing rules
(AGENTS.md → Loading UI).

## 6. Testing routes

Render pages inside a `MemoryRouter` with `initialEntries` (plus
`renderWithProviders`) and assert on what the user sees after navigation,
not on router internals.

## Sources

- [React Router: Picking a Mode](https://reactrouter.com/start/modes)
- [React Router docs (declarative mode)](https://reactrouter.com/start/declarative/installation)
- [LogRocket: React Router v7 modes](https://blog.logrocket.com/react-router-v7-modes/)
- [react.dev: lazy](https://react.dev/reference/react/lazy)
