import { cleanMissingText, joinNotes } from "../../../lib/utils/text";

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

describe("joinNotes", () => {
  it("joins with commas, dropping empties and repeats (case-insensitive)", () => {
    expect(joinNotes(["large", "", null, "minced", "Large", "null"])).toBe("large, minced");
  });

  it("returns empty for no notes", () => {
    expect(joinNotes([])).toBe("");
    expect(joinNotes([undefined, " "])).toBe("");
  });
});
