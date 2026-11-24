# React principles

Applies to: React 19.2 with `eslint-plugin-react-hooks` v7 (its recommended
preset includes rules derived from the React Compiler). The React Compiler
itself is **not** enabled in this build.

## 1. Components are pure functions of props and state

- Rendering must not have side effects: no writes to module variables, no
  mutating props or state, no reading `ref.current` during render, no
  `Math.random()`/`Date.now()` in the render body (compute those in an event
  handler, or once in a `useState` initializer).
- Never mutate state. Create new arrays and objects
  (`[...items, next]`, `items.map(...)`, `{ ...draft, title }`).
- Treat react-hooks lint errors as bugs, not style. They flag exactly the
  impure patterns that break under Strict Mode and concurrent rendering.

**Why:** React may render a component more than once, pause it, or throw a
render away. Pure renders make that safe.

## 2. Don't sync state in effects ("You Might Not Need an Effect")

Effects are for synchronizing with systems outside React (browser APIs,
timers, subscriptions, third-party widgets). Before writing `useEffect`, ask
which of these applies:

| Situation | Do this instead |
|---|---|
| A value can be computed from props/state | Compute it during render |
| The computation is expensive | `useMemo` (measure first) |
| Something should happen because the user did something | Do it in the event handler |
| State should reset when a prop changes (e.g. a different recipe id) | Give the component a `key` |
| Fetch data | A `queries.ts` hook (TanStack Query), never `useEffect` + `fetch` |
| Notify a parent of a change | Call the parent's callback in the same event handler |

When an effect is the right tool, always return a cleanup for anything it
starts (listeners, timers, subscriptions), and list every dependency
honestly. Never silence `exhaustive-deps`. If the dependency list is
awkward, restructure the code.

## 3. Keep state minimal and in the right place

- Store the smallest set of state that can describe the UI and derive the
  rest. Don't store values that duplicate props or other state.
- Keep state as close as possible to where it's used, and lift it only as
  far as the nearest common parent that needs it.
- Server data belongs to TanStack Query (see
  [tanstack-query.md](tanstack-query.md)), not `useState`. Copy it into local
  state only to start an editable draft (a form), and say so in a comment.
- Group related state that changes together into one object or a
  `useReducer`. Prefer a status union over several booleans (see
  [typescript.md](typescript.md) → Model states).
- Use context for values that are read widely and change rarely (session,
  preferences). Expose it through purpose-named hooks (`useWeek()`), as the
  preferences module does.

## 4. Composition and component size

- Keep components small and mostly presentational. Move data loading to
  `queries.ts` hooks and pure logic to `utils/` (AGENTS.md → Modularization).
- Build with composition (`children`, slot props) instead of boolean props
  that toggle large chunks of UI.
- Define components at module top level. Never define a component inside
  another component's body, because it remounts on every render and loses
  its state.
- Give list items stable `key`s from data (`id`), never the array index for
  lists that can be reordered, inserted into, or deleted from.

## 5. React 19 features: use them where they fit

- `ref` is a normal prop in React 19. Don't add `forwardRef` to new
  components.
- `useOptimistic` and Actions (`useActionState`, `<form action>`) are
  available. In this repo, server mutations go through `queries.ts` action
  hooks, which update the cache only after the database confirms the change,
  so don't bypass them with form Actions that call `api.ts` directly.
- `useId` for ids that link labels, inputs, and ARIA attributes. Never
  hard-code ids in reusable components.
- Render metadata (`<title>`) in components only when a page actually needs
  it.

## 6. Performance: measure, then optimize

- Without the compiler, `useMemo`/`useCallback`/`memo` are manual. Add them
  when a value is passed to a memoized child or used as a dependency and
  needs a stable identity, or when a computation is measurably slow. Don't
  wrap everything by default.
- Avoid passing new object or array literals to memoized children or to
  context providers on every render.
- Split routes and heavy, rarely used UI with `React.lazy` + `Suspense` when
  bundle size calls for it (see [vite.md](vite.md)).

## 7. Accessibility is part of correctness

- Use semantic elements first: `<button>` for actions, `<a>`/`<Link>` for
  navigation, `<label>` tied to every input, headings in order.
- Every interactive element must be reachable and usable by keyboard, with a
  visible focus style.
- Use ARIA only when no native element does the job (comboboxes, live
  regions). Follow the WAI-ARIA Authoring Practices pattern for that widget.
- Announce async results (saved, errors) with a live region or move focus
  to them.

## Sources

- [react.dev: You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
- [react.dev: Keeping Components Pure](https://react.dev/learn/keeping-components-pure)
- [react.dev: Choosing the State Structure](https://react.dev/learn/choosing-the-state-structure)
- [react.dev: React 19 release post](https://react.dev/blog/2024/12/05/react-19)
- [react.dev: useOptimistic](https://react.dev/reference/react/useOptimistic)
- [react.dev: React Compiler](https://react.dev/learn/react-compiler)
- [DEV: Why I stopped using useEffect to sync state](https://dev.to/jtorchia/why-i-stopped-using-useeffect-to-sync-state-and-what-i-use-instead-15e4)
- [WAI-ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
