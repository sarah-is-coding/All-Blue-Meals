import {
  parseIngredientText,
  parseName,
} from "../../../../features/ingredients/utils/ingredientText";

// Most inputs below are real catalog names (2026-11-17).

const single = (text: string, options = {}) => {
  const result = parseIngredientText(text, options);
  expect(result.items).toHaveLength(1);
  return result.items[0]!;
};

describe("parseName", () => {
  it.each([
    ["large onion", "onion", ["large"]],
    ["medium red onion", "red onion", ["medium"]],
    ["fresh parsley", "parsley", ["fresh"]],
    ["freshly ground black pepper", "black pepper", ["freshly ground"]],
    ["warm water", "water", ["warm"]],
    ["organic carrots", "carrots", ["organic"]],
    ["ripe tomatoes", "tomatoes", ["ripe"]],
    ["parm cheese shredded", "parm cheese", ["shredded"]],
    ["minced garlic", "garlic", ["minced"]],
    ["chopped cilantro", "cilantro", ["chopped"]],
    ["grated ginger", "ginger", ["grated"]],
    ["basil leaves", "basil", ["leaves"]],
    ["broccoli florets", "broccoli", ["florets"]],
    ["frozen corn kernels", "frozen corn", ["kernels"]],
  ])("%s → %s + %j", (input, name, notes) => {
    const parsed = parseName(input);
    expect(parsed.name).toBe(name);
    expect(parsed.notes).toEqual(notes);
  });

  // Cautious rule: words that make a different product stay in the name.
  it.each([
    "diced tomatoes", "crushed tomatoes", "chopped walnuts", "shredded mozzarella cheese",
    "grated parmesan", "ground beef", "dried oregano", "ground cloves", "whole cloves",
    "dried bay leaves", "toasted sesame oil", "fresh mozzarella", "medium cheddar cheese",
    "hot dog buns", "whole milk", "sliced almonds", "unsalted butter",
  ])("%s keeps its name", (input) => {
    expect(parseName(input)).toEqual({ name: input, notes: [], unitHint: null });
  });

  it("turns garlic cloves and slices into a unit hint", () => {
    expect(parseName("garlic cloves")).toEqual({ name: "garlic", notes: [], unitHint: "clove" });
    expect(parseName("whole garlic cloves")).toEqual({
      name: "garlic",
      notes: ["whole"],
      unitHint: "clove",
    });
    expect(parseName("ginger slices")).toEqual({ name: "ginger", notes: [], unitHint: "slice" });
  });

  it("returns an empty name for empty input", () => {
    expect(parseName("")).toEqual({ name: "", notes: [], unitHint: null });
  });
});

describe("parseIngredientText: commas", () => {
  it("moves prep after a comma to notes", () => {
    expect(single("garlic, minced")).toMatchObject({ name: "garlic", notes: ["minced"] });
    expect(single("red onion, thinly sliced")).toMatchObject({
      name: "red onion",
      notes: ["thinly sliced"],
    });
    expect(single("carrots, cut into 1/2-inch cubes")).toMatchObject({
      name: "carrots",
      notes: ["cut into 1/2-inch cubes"],
    });
    expect(single("garlic, grated or crushed")).toMatchObject({
      name: "garlic",
      notes: ["grated or crushed"],
      substitutes: [],
    });
    expect(single("ground beef, 80/20")).toMatchObject({ name: "ground beef", notes: ["80/20"] });
    expect(single("fresh parsley, chopped")).toMatchObject({
      name: "parsley",
      notes: ["fresh", "chopped"],
    });
  });

  it("joins descriptor commas into the name", () => {
    expect(single("boneless, skinless chicken thighs").name).toBe("boneless skinless chicken thighs");
    expect(single("chicken thighs, bone in, skin on").name).toBe("bone-in skin-on chicken thighs");
  });

  it("splits a list of ingredients instead of keeping one", () => {
    const result = parseIngredientText("broccoli, zucchini, mushrooms, peppers, cauliflower");
    expect(result.split).toBe("list");
    expect(result.flags).toContain("list");
    expect(result.items.map((item) => item.name)).toEqual([
      "broccoli", "zucchini", "mushrooms", "peppers", "cauliflower",
    ]);
  });

  it("flags a comma it doesn't understand and keeps the text", () => {
    const result = parseIngredientText("sourdough, the good kind");
    expect(result.flags).toContain("unclear-comma");
    expect(result.items[0]!.name).toBe("sourdough, the good kind");
  });

  it("moves parentheses to notes", () => {
    expect(single("wholegrains (such as pearled spelt or barley)")).toMatchObject({
      name: "wholegrains",
      notes: ["such as pearled spelt or barley"],
      substitutes: [],
    });
  });
});

describe("parseIngredientText: alternatives", () => {
  const subNames = (text: string, options = {}) => {
    const item = single(text, options);
    return [item.name, ...item.substitutes.map((sub) => sub.name)];
  };

  it.each([
    ["olive oil or vegetable oil", ["olive oil", "vegetable oil"]],
    ["avocado oil or ghee", ["avocado oil", "ghee"]],
    ["honey or maple syrup", ["honey", "maple syrup"]],
    ["olive or grapeseed oil", ["olive oil", "grapeseed oil"]],
    ["chicken or beef broth", ["chicken broth", "beef broth"]],
    ["crushed or pureed tomatoes", ["crushed tomatoes", "pureed tomatoes"]],
    ["thai or serrano chilies", ["thai chilies", "serrano chilies"]],
    ["coriander / cilantro", ["coriander", "cilantro"]],
    ["fresh dill or parsley", ["dill", "parsley"]],
    ["fresh parsley or cilantro sprigs", ["parsley", "cilantro"]],
    ["ground beef or lamb", ["ground beef", "ground lamb"]],
    ["boneless skinless chicken breasts (or thighs)", [
      "boneless skinless chicken breasts", "boneless skinless chicken thighs",
    ]],
    ["bone-in, skin-on chicken legs or thighs", [
      "bone-in skin-on chicken legs", "bone-in skin-on chicken thighs",
    ]],
  ])("%s → %j", (input, expected) => {
    expect(subNames(input)).toEqual(expected);
  });

  it("uses the catalog to avoid inventing names", () => {
    const known = new Set(["quinoa", "brown rice"]);
    const isKnownIngredient = (name: string) => known.has(name);
    expect(subNames("quinoa or brown rice", { isKnownIngredient })).toEqual(["quinoa", "brown rice"]);
    // Without the catalog, "rice" looks like a shared head noun.
    expect(subNames("quinoa or brown rice")).toEqual(["quinoa rice", "brown rice"]);
  });

  it("keeps vague options as a note, not a substitute", () => {
    expect(single("shallot or other onion")).toMatchObject({
      name: "shallot",
      notes: ["or other onion"],
      substitutes: [],
    });
    expect(single("stevia or sweetener of choice")).toMatchObject({
      name: "stevia",
      notes: ["or sweetener of choice"],
    });
  });

  it("keeps comma notes on the main option", () => {
    const item = single("sirloin or strip steak, trimmed and cut into 1-inch cubes");
    expect(item.name).toBe("sirloin steak");
    expect(item.notes).toEqual(["trimmed and cut into 1-inch cubes"]);
    expect(item.substitutes.map((sub) => sub.name)).toEqual(["strip steak"]);
  });
});

describe("parseIngredientText: combined staples and other cases", () => {
  it.each([
    ["salt and pepper", ["salt", "black pepper"]],
    ["salt & black pepper", ["salt", "black pepper"]],
    ["kosher salt and freshly ground black pepper", ["kosher salt", "black pepper"]],
  ])("splits %s", (input, expected) => {
    const result = parseIngredientText(input);
    expect(result.split).toBe("staples");
    expect(result.items.map((item) => item.name)).toEqual(expected);
  });

  it("does not split products joined with 'and'", () => {
    for (const name of ["half & half", "arugula and spinach mix", "frozen mixed peas & carrots"]) {
      expect(parseIngredientText(name).split).toBeNull();
    }
  });

  it("reorders 'juice of' and 'zest of'", () => {
    expect(single("juice of lime").name).toBe("lime juice");
    expect(single("zest of lemon").name).toBe("lemon zest");
    expect(single("juice of 2 limes").name).toBe("lime juice");
  });

  it("flags brands and placeholders", () => {
    expect(parseIngredientText("Hershey's cocoa powder").flags).toContain("brand");
    expect(parseIngredientText("Stonefire® naan original").flags).toContain("brand");
    expect(parseIngredientText("Stonefire® naan original").items[0]!.name).toBe("stonefire naan original");
    expect(parseIngredientText("toppings").flags).toContain("placeholder");
    expect(parseIngredientText("garlic").flags).toEqual([]);
  });

  it("returns nothing for empty input", () => {
    expect(parseIngredientText("  ")).toEqual({ items: [], split: null, flags: [] });
  });
});
