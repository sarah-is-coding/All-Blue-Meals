import {
  chooseDisplayName,
  dropsWords,
  foldText,
  ingredientKey,
  singularDisplayName,
  singularizeWord,
} from "../../../../features/ingredients/utils/ingredientKey";

describe("foldText", () => {
  it("lowercases, strips accents and symbols, and spaces out punctuation", () => {
    expect(foldText("Jalapeño")).toBe("jalapeno");
    expect(foldText("Gruyère")).toBe("gruyere");
    expect(foldText("Stonefire® Naan")).toBe("stonefire naan");
    expect(foldText("half & half")).toBe("half and half");
    expect(foldText("hershey's")).toBe("hersheys");
    expect(foldText("all-purpose, flour")).toBe("all purpose flour");
  });

  it("returns empty for empty input", () => {
    expect(foldText("")).toBe("");
    expect(foldText(" - ")).toBe("");
  });
});

describe("singularizeWord", () => {
  it.each([
    ["onions", "onion"], ["tomatoes", "tomato"], ["potatoes", "potato"],
    ["berries", "berry"], ["anchovies", "anchovy"], ["peaches", "peach"],
    ["radishes", "radish"], ["olives", "olive"], ["cloves", "clove"], ["sauces", "sauce"],
    ["leaves", "leaf"], ["loaves", "loaf"], ["chilies", "chili"], ["chiles", "chile"],
    ["cookies", "cookie"], ["eggs", "egg"], ["jalapenos", "jalapeno"],
  ])("%s → %s", (plural, singular) => {
    expect(singularizeWord(plural)).toBe(singular);
  });

  it("leaves words that only look plural", () => {
    for (const word of ["hummus", "asparagus", "couscous", "molasses", "swiss", "citrus", "grass"]) {
      expect(singularizeWord(word)).toBe(word);
    }
  });

  it("leaves short words and singular words alone", () => {
    expect(singularizeWord("gas")).toBe("gas");
    expect(singularizeWord("onion")).toBe("onion");
  });
});

describe("ingredientKey", () => {
  // Every group here is a real set of duplicates from the catalog (2026-11-17).
  it.each([
    [["all purpose flour", "all-purpose flour"]],
    [["extra virgin olive oil", "extra-virgin olive oil"]],
    [["boneless skinless chicken thighs", "boneless, skinless chicken thighs"]],
    [["low sodium chicken broth", "low-sodium chicken broth"]],
    [["whole grain mustard", "whole-grain mustard"]],
    [["onion", "onions", "Onions"]],
    [["tomato", "tomatoes"]],
    [["egg", "eggs"]],
    [["carrot", "carrots"]],
    [["jalapeño", "jalapeños", "jalapeno"]],
    [["sweet potato", "sweet potatoes"]],
    [["bread crumbs", "breadcrumbs"]],
    [["corn starch", "cornstarch"]],
    [["sun-dried tomatoes", "sundried tomatoes"]],
    [["green onion", "green onions"]],
    [["red pepper flakes", "red pepper flake"]],
    [["half and half", "half & half"]],
  ])("%j share one key", (names) => {
    const keys = new Set(names.map(ingredientKey));
    expect(keys.size).toBe(1);
  });

  // Synonyms and misspellings are not a spelling rule: they resolve through
  // the ingredient_aliases table (docs/ingredient-normalization.md, 10b).
  it.each([
    ["green onion", "scallions"],
    ["potato", "potatoe"],
    ["chili powder", "chile powder"],
    ["heavy cream", "heavy whipping cream"],
    ["bok choy", "pak choi"],
  ])("%s and %s need an alias row to match", (canonical, variant) => {
    expect(ingredientKey(canonical)).not.toBe(ingredientKey(variant));
  });

  // Cautious rule: different products must not merge.
  it.each([
    ["diced tomatoes", "tomatoes"],
    ["ground beef", "beef"],
    ["dried oregano", "oregano"],
    ["salted butter", "unsalted butter"],
    ["low-sodium chicken broth", "chicken broth"],
    ["cherry tomatoes", "tomatoes"],
    ["coriander", "cilantro"],
    ["ground ginger", "ginger"],
    ["lime juice", "lime"],
    ["parmigiano-reggiano cheese", "parmesan"],
  ])("%s and %s stay separate", (a, b) => {
    expect(ingredientKey(a)).not.toBe(ingredientKey(b));
  });

  it("returns empty for an empty name", () => {
    expect(ingredientKey("")).toBe("");
    expect(ingredientKey("  ")).toBe("");
  });
});

describe("singularDisplayName", () => {
  it("makes the last word singular by default", () => {
    expect(singularDisplayName("onions")).toBe("onion");
    expect(singularDisplayName("green onions")).toBe("green onion");
    expect(singularDisplayName("sweet potatoes")).toBe("sweet potato");
    expect(singularDisplayName("tomatoes")).toBe("tomato");
  });

  it("keeps plural for things normally written that way", () => {
    expect(singularDisplayName("eggs")).toBe("eggs");
    expect(singularDisplayName("black beans")).toBe("black beans");
    expect(singularDisplayName("cherry tomatoes")).toBe("cherry tomatoes");
    expect(singularDisplayName("blueberries")).toBe("blueberries");
    expect(singularDisplayName("rolled oats")).toBe("rolled oats");
    expect(singularDisplayName("red pepper flakes")).toBe("red pepper flakes");
  });

  it("keeps accents", () => {
    expect(singularDisplayName("jalapeños")).toBe("jalapeño");
  });

  it("returns empty for empty input", () => {
    expect(singularDisplayName("")).toBe("");
  });
});

describe("chooseDisplayName", () => {
  it("picks the most used variant, in singular form", () => {
    expect(
      chooseDisplayName([
        { name: "onions", uses: 5 },
        { name: "onion", uses: 2 },
      ])
    ).toBe("onion");
  });

  it("breaks ties with fewer commas, then alphabetically", () => {
    expect(
      chooseDisplayName([
        { name: "boneless, skinless chicken thighs", uses: 1 },
        { name: "boneless skinless chicken thighs", uses: 1 },
      ])
    ).toBe("boneless skinless chicken thighs");
    expect(
      chooseDisplayName([
        { name: "extra-virgin olive oil", uses: 1 },
        { name: "extra virgin olive oil", uses: 1 },
      ])
    ).toBe("extra virgin olive oil");
  });

  it("returns empty for no variants", () => {
    expect(chooseDisplayName([])).toBe("");
  });
});

describe("dropsWords", () => {
  it("is true when the general name only leaves words out", () => {
    expect(dropsWords("skinless boneless chicken breasts", "chicken breasts")).toBe(true);
    expect(dropsWords("flat-leaf parsley", "Parsley")).toBe(true);
  });

  it("is false for synonyms, spellings and reordered words", () => {
    expect(dropsWords("scallions", "green onion")).toBe(false);
    expect(dropsWords("onions", "onion")).toBe(false);
    expect(dropsWords("skinless boneless chicken breasts", "boneless skinless chicken breasts")).toBe(false);
  });

  it("is false when the other name adds or changes words", () => {
    expect(dropsWords("coriander leaves", "cilantro")).toBe(false);
    expect(dropsWords("chicken breasts", "boneless chicken breasts")).toBe(false);
  });

  it("is false for empty names", () => {
    expect(dropsWords("parsley", "")).toBe(false);
    expect(dropsWords("", "")).toBe(false);
  });
});
