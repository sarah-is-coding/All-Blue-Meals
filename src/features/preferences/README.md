# Preferences Feature

The signed-in user's preferences (how often they plan meals, which day weeks
start on), stored on their `profiles` row.

- `api.ts` loads and saves them; a user with no row gets the defaults.
- `queries.ts` caches them. `src/app/PreferencesProvider.tsx` shares them with
  every page through `PreferencesContext` (`src/lib/preferences`), so other
  features read them through purpose hooks (`useWeek()`, `usePlanningPeriod()`) and
  never import this feature.
- `pages/PreferencesPage.tsx` is the page behind the user icon in the header.
  New kinds of preference get their own section there.
