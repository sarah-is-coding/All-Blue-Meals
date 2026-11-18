import { buildCleanupPlan, type SourcePlan } from "../../../scripts/ingredient-cleanup/plan";
import { renderReview } from "../../../scripts/ingredient-cleanup/report";

// Step 7 of docs/ingredient-normalization.md: the cleanup plan built from a
// catalog snapshot (here a small sample of real names).

const actionOf = (plan: ReturnType<typeof buildCleanupPlan>, name: string): SourcePlan["action"] =>
  plan.sources.find((source) => source.name === name)!.action;
const groupNamed = (plan: ReturnType<typeof buildCleanupPlan>, name: string) =>
  plan.groups.find((group) => group.name === name);

describe("buildCleanupPlan", () => {
  const catalog = [
    "garlic", "garlic, minced", "minced garlic", "garlic cloves",
    "onion", "onions", "large onion",
    "scallions", "green onion",
    "olive oil", "olive or grapeseed oil",
    "salt and pepper", "salt", "black pepper",
    "diced tomatoes", "tomatoes",
    "stonefire® naan original or garlic",
  ];
  const plan = buildCleanupPlan(catalog, ["Tablespoons", "ounce can", "null"], {
    keep: ["stonefire® naan original or garlic"],
  });

  it("merges spellings, prep and size variants into one ingredient, moving the words to notes", () => {
    expect(groupNamed(plan, "garlic")?.owners.sort()).toEqual(["garlic", "garlic cloves", "garlic, minced", "minced garlic"]);
    expect(actionOf(plan, "garlic, minced")).toEqual({
      kind: "merge",
      target: { key: "garlic", notes: ["minced"], unitHint: null },
    });
    expect(actionOf(plan, "garlic cloves")).toMatchObject({ target: { unitHint: "clove" } });
    expect(groupNamed(plan, "onion")?.owners.sort()).toEqual(["large onion", "onion", "onions"]);
  });

  it("merges seed synonyms into the canonical ingredient and records them", () => {
    const greenOnion = groupNamed(plan, "green onion")!;
    expect(greenOnion.owners.sort()).toEqual(["green onion", "scallions"]);
    expect(greenOnion.seedAliases).toEqual(["scallions"]);
  });

  it("splits 'or' names into a main ingredient and substitutes, creating missing ones", () => {
    expect(actionOf(plan, "olive or grapeseed oil")).toMatchObject({
      kind: "substitutes",
      target: { key: "oliveoil" },
      substitutes: [{ key: "grapeseedoil" }],
    });
    expect(groupNamed(plan, "grapeseed oil")).toMatchObject({ created: true, owners: [] });
  });

  it("splits combined staples", () => {
    expect(actionOf(plan, "salt and pepper")).toMatchObject({
      kind: "split",
      how: "staples",
      items: [{ key: "salt" }, { key: "blackpepper" }],
    });
  });

  it("keeps different products and overridden names as they are", () => {
    expect(actionOf(plan, "diced tomatoes")).toEqual({ kind: "unchanged" });
    expect(groupNamed(plan, "tomato")?.owners).toEqual(["tomatoes"]);
    expect(actionOf(plan, "stonefire® naan original or garlic")).toEqual({ kind: "unchanged" });
  });

  it("renames a group when the override says so", () => {
    const renamed = buildCleanupPlan(["onions"], [], { names: { onion: "yellow onions" } });
    expect(renamed.groups[0]!.name).toBe("yellow onions");
  });

  it("cleans rewritten text instead of the name when the override says so", () => {
    const rewritten = buildCleanupPlan(["pepper", "black pepper", "stonefire® naan original or garlic"], [], {
      rewrite: { pepper: "black pepper", "stonefire® naan original or garlic": "naan (Stonefire, original or garlic)" },
    });
    expect(rewritten.groups.find((group) => group.key === "blackpepper")?.owners.sort()).toEqual(["black pepper", "pepper"]);
    expect(actionOf(rewritten, "stonefire® naan original or garlic")).toEqual({
      kind: "rename",
      target: { key: "naan", notes: ["stonefire, original or garlic"], unitHint: null },
    });
  });

  it("plans each unit spelling, including sizes written as quantity + unit", () => {
    expect(plan.units).toEqual([
      { raw: "Tablespoons", unit: "tbsp", notes: [] },
      { raw: "ounce can", unit: "can", notes: [], sizeUnit: "oz" },
      { raw: "null", unit: "", notes: [] },
    ]);
  });

  it("returns an empty plan for an empty catalog", () => {
    expect(buildCleanupPlan([], [])).toEqual({ sources: [], groups: [], units: [] });
  });
});

describe("renderReview", () => {
  it("summarizes the plan and lists merges, splits, units and deletions", () => {
    const plan = buildCleanupPlan(["onion", "onions", "salt and pepper"], ["cups"]);
    const review = renderReview(plan, ["apple cider"], "2026-11-17");

    expect(review).toContain("# Ingredient cleanup: review");
    expect(review).toContain("| **onion** | `onion`, `onions` | `onion` |");
    expect(review).toContain("`salt and pepper` → salt + black pepper *(staples)*");
    expect(review).toContain("| `cups` | cup |  |");
    expect(review).toContain("- `apple cider`");
  });
});
