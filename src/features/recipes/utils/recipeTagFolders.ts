// The "Tag folders" view: one folder per tag, ignoring case, with how many
// recipes have it. Pure, so it's easy to test.

export type RecipeTagFolder = {
  /** Lowercase tag; what the folder filters by. */
  key: string;
  /** How it's shown: the spelling most recipes use ("Italian" over "italian"). */
  label: string;
  /** Recipes with this tag. */
  count: number;
};

const hasCapital = (text: string) => text !== text.toLowerCase();

/** Folders for every tag across these recipes' tag lists, A to Z. */
export function tagFolders(tagLists: ReadonlyArray<ReadonlyArray<string> | null>): RecipeTagFolder[] {
  const folders = new Map<string, { count: number; spellings: Map<string, number> }>();
  for (const tags of tagLists) {
    // A recipe counts once per folder, even if it repeats a tag in another case.
    const seen = new Set<string>();
    for (const tag of tags ?? []) {
      const label = tag.replace(/\s+/g, " ").trim();
      const key = label.toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const folder = folders.get(key) ?? { count: 0, spellings: new Map<string, number>() };
      folder.count += 1;
      folder.spellings.set(label, (folder.spellings.get(label) ?? 0) + 1);
      folders.set(key, folder);
    }
  }
  return [...folders.entries()]
    .map(([key, { count, spellings }]) => ({
      key,
      // Most used spelling; on a tie, one with capitals ("Italian" over
      // "italian"), then alphabetical, so the name is always the same.
      label: [...spellings.entries()].sort(
        (a, b) => b[1] - a[1] || Number(hasCapital(b[0])) - Number(hasCapital(a[0])) || a[0].localeCompare(b[0])
      )[0]![0],
      count,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

/** Folders whose name contains the typed text, ignoring case. */
export function filterTagFolders(folders: ReadonlyArray<RecipeTagFolder>, text: string): RecipeTagFolder[] {
  const needle = text.trim().toLowerCase();
  return needle ? folders.filter((folder) => folder.key.includes(needle)) : [...folders];
}
