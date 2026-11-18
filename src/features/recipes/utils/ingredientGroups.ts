// Recipe ingredients are a flat list where a substitute row points at its
// main row ("2 tbsp olive oil or avocado oil" is two rows). These helpers
// group, add and remove rows while keeping that link consistent.

type LinkedRow = { id: string; substituteFor: string | null };

export type IngredientGroup<T> = { main: T; substitutes: T[] };

/**
 * Group rows as main + substitutes, in the order the main rows appear.
 * A substitute whose main row is missing, or that points at another
 * substitute, is treated as a main row so nothing disappears.
 */
export const groupSubstitutes = <T extends LinkedRow>(rows: ReadonlyArray<T>): IngredientGroup<T>[] => {
  const mainIds = new Set(rows.filter((row) => row.substituteFor === null).map((row) => row.id));
  const isMain = (row: T) => row.substituteFor === null || !mainIds.has(row.substituteFor);

  const groups: IngredientGroup<T>[] = [];
  const byMainId = new Map<string, IngredientGroup<T>>();
  for (const row of rows) {
    if (isMain(row)) {
      const group = { main: row, substitutes: [] };
      groups.push(group);
      byMainId.set(row.id, group);
    }
  }
  for (const row of rows) {
    if (!isMain(row) && row.substituteFor) {
      byMainId.get(row.substituteFor)?.substitutes.push(row);
    }
  }
  return groups;
};

/** Flatten groups back to main, its substitutes, next main, … */
export const flattenGroups = <T>(groups: ReadonlyArray<IngredientGroup<T>>): T[] =>
  groups.flatMap((group) => [group.main, ...group.substitutes]);

/** Insert a new substitute row directly after the main row's existing substitutes. */
export const insertSubstitute = <T extends LinkedRow>(
  rows: ReadonlyArray<T>,
  mainId: string,
  newRow: T
): T[] => {
  const groups = groupSubstitutes(rows);
  const group = groups.find((candidate) => candidate.main.id === mainId);
  if (!group) return [...rows];
  group.substitutes.push({ ...newRow, substituteFor: mainId });
  return flattenGroups(groups);
};

/** Remove a row; removing a main row also removes its substitutes. */
export const removeRowWithSubstitutes = <T extends LinkedRow>(
  rows: ReadonlyArray<T>,
  rowId: string
): T[] => rows.filter((row) => row.id !== rowId && row.substituteFor !== rowId);
