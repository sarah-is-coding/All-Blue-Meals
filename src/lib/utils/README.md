# Utility Functions

Generic, pure helpers used by more than one feature. Code here must not import from `src/features` or `src/app` (enforced by ESLint).

- `dates.ts` — local-time `YYYY-MM-DD` helpers and Monday-start week math
- `quantities.ts` — parse and scale free-text ingredient quantities
- `units.ts` — one spelling per unit ("Tablespoons", "tbs" → "tbsp"); text that isn't a unit moves to notes
- `text.ts` — `cleanMissingText` (treats "null", "none", "n/a" as empty) and `joinNotes`

Tests live in `src/__tests__/lib/utils/`.
