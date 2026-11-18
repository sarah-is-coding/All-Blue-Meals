import {
  CATEGORY_CODES,
  FALLBACK_CATEGORIES,
  toCategoryCode,
} from "../../../../features/ingredients/categories/codes";

// Step 9 of docs/ingredient-normalization.md: categories are grocery store
// departments with short codes.

describe("toCategoryCode", () => {
  it("accepts every code, in any case and with spaces around it", () => {
    for (const code of CATEGORY_CODES) expect(toCategoryCode(code)).toBe(code);
    expect(toCategoryCode(" Produce ")).toBe("produce");
  });

  // Phase 2 rewrote the stored data to codes, so the older labels are no
  // longer translated: like "pantry" (split into several departments), they
  // have no code.
  it("has no code for the older labels", () => {
    expect(toCategoryCode("meat & seafood")).toBeNull();
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
