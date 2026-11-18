import {
  flattenGroups,
  groupSubstitutes,
  insertSubstitute,
  removeRowWithSubstitutes,
} from "../../../../features/recipes/utils/ingredientGroups";

type Row = { id: string; substituteFor: string | null; name: string };
const row = (id: string, substituteFor: string | null = null): Row => ({ id, substituteFor, name: id });
const ids = (rows: Row[]) => rows.map((r) => r.id);

describe("groupSubstitutes", () => {
  it("groups substitutes under their main row, in main-row order", () => {
    const groups = groupSubstitutes([row("oil"), row("salt"), row("avocado", "oil"), row("ghee", "oil")]);
    expect(groups.map((g) => [g.main.id, ids(g.substitutes)])).toEqual([
      ["oil", ["avocado", "ghee"]],
      ["salt", []],
    ]);
  });

  it("treats a substitute with a missing main row as a main row", () => {
    const groups = groupSubstitutes([row("avocado", "gone"), row("salt")]);
    expect(groups.map((g) => g.main.id)).toEqual(["avocado", "salt"]);
  });

  it("treats a substitute of a substitute as a main row", () => {
    const groups = groupSubstitutes([row("oil"), row("avocado", "oil"), row("ghee", "avocado")]);
    expect(groups.map((g) => [g.main.id, ids(g.substitutes)])).toEqual([
      ["oil", ["avocado"]],
      ["ghee", []],
    ]);
  });

  it("returns no groups for no rows", () => {
    expect(groupSubstitutes([])).toEqual([]);
  });
});

describe("flattenGroups", () => {
  it("puts each main row before its substitutes", () => {
    const rows = [row("oil"), row("salt"), row("avocado", "oil")];
    expect(ids(flattenGroups(groupSubstitutes(rows)))).toEqual(["oil", "avocado", "salt"]);
  });
});

describe("insertSubstitute", () => {
  it("adds the new row after the main row's existing substitutes, linked to it", () => {
    const rows = [row("oil"), row("avocado", "oil"), row("salt")];
    const result = insertSubstitute(rows, "oil", row("ghee"));
    expect(ids(result)).toEqual(["oil", "avocado", "ghee", "salt"]);
    expect(result[2]!.substituteFor).toBe("oil");
  });

  it("leaves the rows unchanged when the main row doesn't exist", () => {
    const rows = [row("oil")];
    expect(insertSubstitute(rows, "missing", row("ghee"))).toEqual(rows);
  });
});

describe("removeRowWithSubstitutes", () => {
  it("removes a main row together with its substitutes", () => {
    const rows = [row("oil"), row("avocado", "oil"), row("salt")];
    expect(ids(removeRowWithSubstitutes(rows, "oil"))).toEqual(["salt"]);
  });

  it("removes only the substitute when a substitute is removed", () => {
    const rows = [row("oil"), row("avocado", "oil"), row("ghee", "oil")];
    expect(ids(removeRowWithSubstitutes(rows, "avocado"))).toEqual(["oil", "ghee"]);
  });

  it("returns the same rows when the id isn't found", () => {
    expect(ids(removeRowWithSubstitutes([row("oil")], "nope"))).toEqual(["oil"]);
  });
});
