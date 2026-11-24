# Grocery Feature

Generate a grocery checklist from calendar dates or a saved meal plan. Checkmarks live on the page and reset when you build another list.

- `api.ts`: builds the list items from the meals in a date range or a saved
  plan (merge rules in AGENTS.md).
- `queries.ts`: `useGroceryList`, an on-demand query that runs when the user
  taps Build. Every build reads the meals fresh (`staleTime: 0`), because
  meals change on pages that don't know about grocery lists. The card is
  keyed by build, so ticks start empty each time.
