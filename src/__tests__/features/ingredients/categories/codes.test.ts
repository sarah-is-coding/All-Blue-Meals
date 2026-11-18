import {
  CATEGORY_CODES,
  FALLBACK_CATEGORIES,
  toCategoryCode,
} from "../../../../features/ingredients/categories/codes";

// Step 9 of docs/ingredient-normalization.md: categories are grocery store
// departments with short codes; older values are read until phase 2.

describe("toCategoryCode", () => {
  it("accepts every code, in any case and with spaces around it", () => {
    for (const code of CATEGORY_CODES) expect(toCategoryCode(code)).toBe(code);
    expect(toCategoryCode(" Produce ")).toBe("produce");
  });

  it("maps the older labels to their codes", () => {
    expect(toCategoryCode("meat & seafood")).toBe("meat_seafood");
    expect(toCategoryCode("Dairy & Eggs")).toBe("dairy_eggs");
    expect(toCategoryCode("bakery & bread")).toBe("bakery_bread");
  });

  it("has no code for 'pantry', which was split into several departments", () => {
    expect(toCategoryCode("pantry")).toBeNull();
  });

  it("returns null for empty or unknown values", () => {
    expect(toCategoryCode(null)).toBeNull();
    expect(toCategoryCode(undefined)).toBeNull();
    expect(toCategoryCode("")).toBeNull();
    expect(toCategoryCode("snacks")).toBeNull();
  });
});

describe("FALLBACK_CATEGORIES", () => {
  it("lists every department once, in walking order, with a label", () => {
    expect(FALLBACK_CATEGORIES.map((category) => category.code)).toEqual([...CATEGORY_CODES]);
    expect(FALLBACK_CATEGORIES.map((category) => category.sortOrder)).toEqual(CATEGORY_CODES.map((_, index) => index + 1));
    expect(FALLBACK_CATEGORIES.find((category) => category.code === "oils_sauces_condiments")?.name).toBe(
      "Oils, Sauces & Condiments"
    );
    expect(FALLBACK_CATEGORIES.at(-1)?.code).toBe("other");
  });
});
