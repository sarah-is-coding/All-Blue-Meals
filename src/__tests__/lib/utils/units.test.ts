import { normalizeUnit } from "../../../lib/utils/units";

describe("normalizeUnit", () => {
  // Spellings found in recipe_ingredients.unit (2026-11-17).
  it.each([
    ["cup", "cup"], ["cups", "cup"],
    ["teaspoon", "tsp"], ["teaspoons", "tsp"], ["tsp", "tsp"], ["tsp.", "tsp"],
    ["tablespoon", "tbsp"], ["tablespoons", "tbsp"], ["Tablespoon", "tbsp"],
    ["Tablespoons", "tbsp"], ["tbsp", "tbsp"], ["tbs", "tbsp"], ["TBSP.", "tbsp"], ["TBSP", "tbsp"],
    ["lb", "lb"], ["lb.", "lb"], ["lbs", "lb"], ["pound", "lb"], ["pounds", "lb"],
    ["oz", "oz"], ["ounces", "oz"], ["g", "g"], ["grams", "g"], ["ml", "ml"],
    ["clove", "clove"], ["cloves", "clove"], ["slices", "slice"], ["stalks", "stalk"],
    ["bunch", "bunch"], ["bunches", "bunch"], ["loaves", "loaf"], ["handfuls", "handful"],
    ["pinch", "pinch"], ["drops", "drop"], ["pint", "pint"], ["box", "box"],
  ])("maps %s to %s", (input, expected) => {
    expect(normalizeUnit(input)).toEqual({ unit: expected, notes: [] });
  });

  it("returns no unit for empty, missing-value words and placeholders", () => {
    expect(normalizeUnit("")).toEqual({ unit: "", notes: [] });
    expect(normalizeUnit(null)).toEqual({ unit: "", notes: [] });
    expect(normalizeUnit("null")).toEqual({ unit: "", notes: [] });
    expect(normalizeUnit("unit")).toEqual({ unit: "", notes: [] });
  });

  it("moves size and prep words to notes", () => {
    expect(normalizeUnit("medium")).toEqual({ unit: "", notes: ["medium"] });
    expect(normalizeUnit("large")).toEqual({ unit: "", notes: ["large"] });
    expect(normalizeUnit("diced")).toEqual({ unit: "", notes: ["diced"] });
    expect(normalizeUnit("to taste")).toEqual({ unit: "", notes: ["to taste"] });
    expect(normalizeUnit("medium-large")).toEqual({ unit: "", notes: ["medium-large"] });
  });

  it("moves parenthesised amounts to notes", () => {
    expect(normalizeUnit("(60ml)")).toEqual({ unit: "", notes: ["60 ml"] });
    expect(normalizeUnit("cup (1 stick)")).toEqual({ unit: "cup", notes: ["1 stick"] });
    expect(normalizeUnit("can (4 oz.)")).toEqual({ unit: "can", notes: ["4 oz"] });
  });

  it("splits container sizes into unit + note", () => {
    expect(normalizeUnit("(15 ounce) can")).toEqual({ unit: "can", notes: ["15 oz"] });
    expect(normalizeUnit("28-ounce can")).toEqual({ unit: "can", notes: ["28 oz"] });
    expect(normalizeUnit("13.5oz cans")).toEqual({ unit: "can", notes: ["13.5 oz"] });
    expect(normalizeUnit("32 oz. jar")).toEqual({ unit: "jar", notes: ["32 oz"] });
    expect(normalizeUnit("ounce can")).toEqual({ unit: "can", notes: ["oz"] });
    expect(normalizeUnit("large can")).toEqual({ unit: "can", notes: ["large"] });
    expect(normalizeUnit("(9-ounce) package")).toEqual({ unit: "package", notes: ["9 oz"] });
  });

  it("keeps a description after a unit as a note", () => {
    expect(normalizeUnit("cup loosely packed")).toEqual({ unit: "cup", notes: ["loosely packed"] });
  });

  it("keeps unknown units, lowercased, so nothing is lost", () => {
    expect(normalizeUnit("Smidgen")).toEqual({ unit: "smidgen", notes: [] });
  });
});
