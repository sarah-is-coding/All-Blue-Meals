-- Restore line breaks in recipe instructions.
--
-- From step 3 of docs/ingredient-normalization.md until this fix, saving a
-- recipe cleaned its instructions with the ingredient-text cleaner, which
-- collapsed every newline, so numbered steps were saved as one paragraph.
-- This puts each numbered step back on its own line, with the same rule the
-- import uses (formatImportedInstructions): a break before "<n>. ". Only
-- instructions with no line breaks and at least a "2. " step are touched; on
-- a fresh database there are none.

update public.recipes
set instructions = regexp_replace(instructions, '\s+(\d+\.\s+)', E'\n\\1', 'g')
where instructions !~ '\n'
  and instructions ~ '\s2\.\s';
