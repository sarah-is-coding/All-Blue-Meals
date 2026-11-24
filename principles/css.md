# CSS principles

Applies to: plain CSS in `src/styles/`, using the custom properties in
`global.css` and BEM-style class names. File placement and naming rules are
in CLAUDE.md → CSS; this file covers how to write the CSS.

## 1. Design tokens through custom properties

- Use the existing variables (`--color-brand`, `--color-muted-soft`,
  `--alpha-brand-20`, …) for every color and shared value. A raw hex or rgba
  in a component rule is a missing token: add it to `:root` in `global.css`
  with a name describing its role.
- Prefer a few semantic tokens ("text muted", "surface") over many one-off
  shades. Reuse an existing token before adding a near-duplicate.
- Custom properties cascade, so a component can expose a knob
  (`--recipe-card-accent`) that a parent or modifier overrides, instead of
  duplicating rules.

## 2. Mobile-first layout

- Write base styles for the narrowest screen, then add
  `@media (min-width: …)` rules to enhance for wider ones. Don't start with
  desktop and undo it for phones.
- Lay out with flexbox and grid plus `gap`, not margins on children or
  absolute positioning.
- Use relative and fluid sizing (`rem`, `%`, `min()`/`max()`/`clamp()`)
  so text and layout respect the user's font size. Avoid fixed heights on
  anything that holds text.
- Account for phone UI: use `dvh` (not `vh`) for full-height layouts, and
  `env(safe-area-inset-*)` padding for sticky bottom bars.
- Container queries (`@container`) are well supported. Use them when a
  component appears in containers of different widths (a card in a list
  vs. a side panel), so it responds to its container, not the viewport.

## 3. Thumb-friendly and accessible

- Tap targets at least 44×44 CSS px (the Apple/WCAG AAA guideline; WCAG
  2.2 AA's floor is 24×24), with space between neighboring targets.
- Never remove focus outlines without replacing them. Use `:focus-visible`
  for a clear keyboard focus ring.
- Meet WCAG AA contrast: 4.5:1 for body text, 3:1 for large text and UI
  boundaries. Check muted text tokens on tinted backgrounds.
- Wrap non-essential motion in `@media (prefers-reduced-motion: reduce)` and
  turn it off or shorten it there (several feature files already do this).
- Don't convey meaning by color alone; pair it with text or an icon.
- To hide something visually but keep it for screen readers, use the
  shared `.sr-only` class in `shared.css`, not `display: none`.

## 4. Keep specificity low and predictable

- Style with single class selectors (`.block__element--modifier`). No IDs,
  no element-chained selectors (`div.card > ul li`), and no `!important`
  except to override third-party styles.
- Express state with modifier classes or attributes the markup already has
  (`[aria-expanded="true"]`, `:disabled`, `[aria-current="page"]`). Styling
  by ARIA state keeps the visual state and the accessible state in sync.
- Since equally specific rules are settled by file order (`app.css`), keep
  each component's rules in its area's file and don't style another area's
  classes.
- Use native CSS nesting sparingly (one level, mainly for `&:hover` and
  modifiers) so selectors stay flat and easy to search.

## 5. Performance

- Animate only `transform` and `opacity`. Animating layout properties
  (`width`, `top`, `height`) causes reflow and jank on phones.
- Avoid huge `box-shadow`/`filter: blur()` on large or scrolling areas.
- Use `content-visibility: auto` for long off-screen lists only if
  profiling shows it helps.

## 6. Modern features: adopt deliberately

- Logical properties (`margin-inline`, `padding-block`, `inset-inline-end`)
  are preferred for new rules. They read clearly and are ready for other
  writing directions.
- Cascade layers (`@layer`) would change how the existing `app.css` order
  works. Don't introduce them in a single component; adopting them is a
  whole-codebase decision.

## Sources

- [MDN: Using CSS custom properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
- [MDN: prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
- [MDN: CSS container queries](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries)
- [MDN: CSS logical properties and values](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values)
- [W3C: Understanding WCAG 2.2 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum)
- [W3C: Understanding Target Size (Enhanced)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced)
- [Modern CSS for dynamic component-based architecture](https://moderncss.dev/modern-css-for-dynamic-component-based-architecture/)
- [Smashing Magazine: Writing CSS in 2023](https://smashingmagazine.com/2023/07/writing-css-2023)
