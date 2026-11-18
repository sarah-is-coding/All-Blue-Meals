# Ingredient cleanup (step 7)

One-time cleanup of the ingredient catalog, described in
`docs/ingredient-normalization.md` (section 6 and step 7). Run locally; not
part of the app.

```bash
npm run cleanup:review
```

Builds the plan from the snapshot in `data/` with the app's own naming rules
(`src/features/ingredients/utils`) and writes:

- `review.md`: every merge, rename, split, created ingredient, seed synonym,
  unit change and deletion, for a person to check.
- `plan.json`: the same plan, read by the migration generator once approved.

To change the plan, edit `overrides.json` and run it again:

- `keep`: catalog names to leave exactly as they are.
- `names`: group key → the name the ingredient should end up with.
- `rewrite`: catalog name → corrected text, cleaned by the same rules instead
  (e.g. `"pepper": "black pepper"`, or "peppers" in a vegetable list →
  "bell peppers").
- `noAlias`: names not recorded as aliases when merged away, because they're
  too ambiguous to resolve later (`pepper` could be a bell pepper).

Once the review is approved:

```bash
npm run cleanup:migration
```

writes `supabase/migrations/20261117200000_ingredient_catalog_cleanup.sql`
from `plan.json`. It refuses to overwrite that file (it may be applied);
`-- --force` regenerates one that hasn't been.

Files:

- `plan.ts`: works out the plan (pure).
- `report.ts`: renders `review.md`.
- `migration.ts`: renders the data migration (pure); `generateMigration.ts`
  writes it.
- `seedAliases.ts`: synonyms no spelling rule finds; they become `seed` rows
  in `ingredient_aliases`.
- `data/`: snapshot of the catalog names, unit spellings and unused
  ingredients, taken 2026-11-17.
