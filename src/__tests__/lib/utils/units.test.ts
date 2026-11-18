import { applySizeQuantity, containerSize, normalizeUnit } from "../../../lib/utils/units";

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
    // Was notes ["oz"], which turned "15 ounce can" into 15 cans; the size
    // now comes from the quantity (see "container sizes in the quantity").
    expect(normalizeUnit("ounce can")).toEqual({ unit: "can", notes: [], sizeUnit: "oz" });
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

// A container size written as quantity + unit ("15" + "ounce can") is one
// container of that size, not 15 containers. Found by the step 7 review.
describe("container sizes in the quantity", () => {
  it("marks units that name a size without a number", () => {
    expect(normalizeUnit("ounce can")).toEqual({ unit: "can", notes: [], sizeUnit: "oz" });
    expect(normalizeUnit("g jar")).toEqual({ unit: "jar", notes: [], sizeUnit: "g" });
    expect(normalizeUnit("oz. carton")).toEqual({ unit: "container", notes: [], sizeUnit: "oz" });
    expect(normalizeUnit("15 ounce can").sizeUnit).toBeUndefined();
  });

  it("drops the 'x' in '2 x 125g packs'", () => {
    expect(normalizeUnit("x 125g packs")).toEqual({ unit: "package", notes: ["125 g"] });
  });

  it("moves the quantity into the notes as the size", () => {
    expect(applySizeQuantity("15", normalizeUnit("ounce can"))).toEqual({ quantity: "1", unit: "can", notes: ["15 oz"] });
  });

  it("leaves other lines alone", () => {
    expect(applySizeQuantity("2", normalizeUnit("cups"))).toEqual({ quantity: "2", unit: "cup", notes: [] });
    expect(applySizeQuantity("", normalizeUnit("ounce can"))).toEqual({ quantity: "", unit: "can", notes: [] });
  });
});

// The size you look for at the store ("1 can" of what size?).
describe("containerSize", () => {
  it("finds a size in a container's notes", () => {
    expect(containerSize("can", "15 oz, with liquid")).toBe("15 oz");
    expect(containerSize("can", "14 oz/400 g, undrained")).toBe("14 oz/400 g");
    expect(containerSize("package", "drained, 125 g")).toBe("125 g");
    expect(containerSize("bottle", "16.9 fl oz")).toBe("16.9 fl oz");
  });

  it("ignores notes that aren't a size", () => {
    expect(containerSize("can", "drained and rinsed")).toBeNull();
    expect(containerSize("can", "about 15 oz")).toBeNull();
    expect(containerSize("can", "")).toBeNull();
    expect(containerSize("can", null)).toBeNull();
  });

  it("only applies to containers", () => {
    expect(containerSize("tbsp", "15 oz")).toBeNull();
    expect(containerSize("", "15 oz")).toBeNull();
  });
});
