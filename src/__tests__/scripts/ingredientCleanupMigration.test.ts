import { renderCleanupMigration } from "../../../scripts/ingredient-cleanup/migration";
import { buildCleanupPlan } from "../../../scripts/ingredient-cleanup/plan";

// Step 7 of docs/ingredient-normalization.md: the data migration rendered from
// an approved plan. The SQL itself was dry-run against the snapshot catalog;
// these tests pin what plan data goes in and the safety checks around it.

const approved = (names: string[], units: string[] = [], extra: { unused?: string[]; noAlias?: string[] } = {}) => ({
  snapshotDate: "2026-11-17",
  unused: extra.unused ?? [],
  noAlias: extra.noAlias ?? [],
  ...buildCleanupPlan(names, units, {
    rewrite: { pepper: "black pepper" },
    noAlias: extra.noAlias,
  }),
});

describe("renderCleanupMigration", () => {
  const sql = renderCleanupMigration(
    approved(
      ["garlic", "garlic cloves", "olive or grapeseed oil", "olive oil", "salt and pepper", "salt", "black pepper", "pepper", "Bob's sauce"],
      ["Tablespoons", "ounce can", "cup"],
      { unused: ["apple cider"], noAlias: ["pepper"] }
    ),
    { "green onion": ["scallion"], "black pepper": ["ground pepper"] }
  );

  it("lists each group with its final name", () => {
    expect(sql).toContain("('garlic', 'garlic')");
    expect(sql).toContain("('grapeseedoil', 'grapeseed oil')");
  });

  it("records each owner with its old key, notes, unit hint and whether it becomes an alias", () => {
    expect(sql).toContain("('garlic cloves', 'garlic', 'garlicclove', '{}'::text[], 'clove', true)");
    // Flagged, but the SQL skips aliases whose old key is the group's own key.
    expect(sql).toContain("('garlic', 'garlic', 'garlic', '{}'::text[], null, true)");
    expect(sql).toContain("and m.old_key <> m.key");
    // "or" names aren't aliases of their first option.
    expect(sql).toContain("('olive or grapeseed oil', 'oliveoil', 'oliveorgrapeseedoil', '{}'::text[], null, false)");
  });

  it("never aliases a name listed in noAlias", () => {
    expect(sql).toContain("('pepper', 'blackpepper', 'pepper', '{}'::text[], null, false)");
  });

  it("lists substitutes and split items in order", () => {
    expect(sql).toContain("('olive or grapeseed oil', 'substitute', 1, 'grapeseedoil', '{}'::text[], null)");
    expect(sql).toContain("('salt and pepper', 'staples', 0, 'salt', '{}'::text[], null)");
    expect(sql).toContain("('salt and pepper', 'staples', 1, 'blackpepper', '{}'::text[], null)");
  });

  it("includes only unit spellings that change, with container sizes", () => {
    expect(sql).toContain("('Tablespoons', 'tbsp', '{}'::text[], null)");
    expect(sql).toContain("('ounce can', 'can', '{}'::text[], 'oz')");
    expect(sql).not.toContain("('cup', 'cup'");
  });

  it("adds every seed synonym by key, and the unused names", () => {
    expect(sql).toContain("('scallion', 'scallion', 'greenonion')");
    expect(sql).toContain("('groundpepper', 'ground pepper', 'blackpepper')");
    expect(sql).toContain("insert into cleanup_unused (name) values\n  ('apple cider');");
  });

  it("escapes quotes in names", () => {
    expect(sql).toContain("'Bob''s sauce'");
  });

  it("matches rows by name, checks for key collisions and cleans up after itself", () => {
    expect(sql).toContain("join cleanup_owner o on o.name = i.name");
    expect(sql).toContain("several ingredients share a key");
    expect(sql).toMatch(/drop table cleanup_group, .*cleanup_split_row;/s);
  });

  it("renders an empty plan without empty VALUES lists", () => {
    const empty = renderCleanupMigration(approved([]), {});
    expect(empty).toContain("-- (no cleanup_group rows)");
    expect(empty).not.toMatch(/values\s*;/);
  });
});
