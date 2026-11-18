import { cleanMissingMultilineText, cleanMissingText, joinNotes } from "../../../lib/utils/text";

describe("cleanMissingText", () => {
  it("trims and collapses whitespace", () => {
    expect(cleanMissingText("  2   cups ")).toBe("2 cups");
  });

  it("returns empty for null, undefined and empty input", () => {
    expect(cleanMissingText(null)).toBe("");
    expect(cleanMissingText(undefined)).toBe("");
    expect(cleanMissingText("   ")).toBe("");
  });

  // Real data: 26 imported rows had unit = "null" and quantity = "null".
  it("treats words meaning 'no value' as empty, in any case", () => {
    for (const word of ["null", "NULL", "None", "n/a", "N/A", "undefined", " null "]) {
      expect(cleanMissingText(word)).toBe("");
    }
  });

  it("keeps real text that merely contains those words", () => {
    expect(cleanMissingText("none added")).toBe("none added");
    expect(cleanMissingText("nullabc")).toBe("nullabc");
  });
});

describe("cleanMissingMultilineText", () => {
  it("keeps line breaks, tidying each line", () => {
    expect(cleanMissingMultilineText("  1. Chop   the onion. \n2. Fry it.\n")).toBe("1. Chop the onion.\n2. Fry it.");
  });

  it("normalizes Windows line endings and runs of blank lines", () => {
    expect(cleanMissingMultilineText("1. Mix.\r\n\r\n\r\n\r\n2. Bake.\r3. Cool.")).toBe("1. Mix.\n\n2. Bake.\n3. Cool.");
  });

  it("returns empty for null, blank and 'no value' input", () => {
    expect(cleanMissingMultilineText(null)).toBe("");
    expect(cleanMissingMultilineText(undefined)).toBe("");
    expect(cleanMissingMultilineText(" \n \n ")).toBe("");
    expect(cleanMissingMultilineText(" N/A ")).toBe("");
  });

  it("keeps real text that merely contains those words", () => {
    expect(cleanMissingMultilineText("null\nnone left")).toBe("null\nnone left");
  });
});

describe("joinNotes", () => {
  it("joins with commas, dropping empties and repeats (case-insensitive)", () => {
    expect(joinNotes(["large", "", null, "minced", "Large", "null"])).toBe("large, minced");
  });

  it("returns empty for no notes", () => {
    expect(joinNotes([])).toBe("");
    expect(joinNotes([undefined, " "])).toBe("");
  });
});
