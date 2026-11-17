# Ingredients Feature

The shared ingredient catalog: searching it and adding new ingredients
(name, category, default unit). Used by recipes and grocery lists.

## Naming rules (`utils/`)

Pure functions that decide when two names are the same ingredient and how
an ingredient line is cleaned before saving. Background and the "cautious
merge rule" are in `docs/ingredient-normalization.md`.

- `ingredientKey.ts`: the matching key (ignores case, accents, punctuation,
  spaces and plurals) and the name to show (`singularDisplayName`,
  `chooseDisplayName`). Synonyms such as "scallions" → green onion are not
  here; they're rows in the `ingredient_aliases` table.
- `ingredientText.ts`: splits a written name into a clean name, notes, "or"
  substitutes, or several ingredients ("salt and pepper", a comma list), and
  flags anything it can't decide for review.
- `ingredientLine.ts`: applies the above to a whole line (name, quantity,
  unit, notes), using the shared `normalizeUnit` and `cleanMissingText`
  from `src/lib/utils`.
- `constants.ts`: the word lists behind those rules (size, prep and form
  words, plural exceptions). Extend them when real names show a gap.
