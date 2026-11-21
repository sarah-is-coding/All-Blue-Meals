import { previewTags } from "../../../../features/recipes/utils/recipeTags";

describe("previewTags", () => {
  it("keeps the recipe's order and counts the tags that don't fit", () => {
    expect(previewTags(["quick", "mexican", "weeknight", "spicy"], 3)).toEqual({
      shown: ["quick", "mexican", "weeknight"],
      hiddenCount: 1,
    });
  });

  it("moves marinate tags first, whatever their case or form", () => {
    expect(previewTags(["quick", "grill", "Marinate overnight", "marinated"], 3)).toEqual({
      shown: ["Marinate overnight", "marinated", "quick"],
      hiddenCount: 1,
    });
  });

  it("shows a marinate tag even when it's past the limit", () => {
    expect(previewTags(["a", "b", "c", "d", "marinate 4 hrs"], 2).shown).toEqual(["marinate 4 hrs", "a"]);
  });

  it("drops blank tags", () => {
    expect(previewTags(["  ", "quick", ""], 3)).toEqual({ shown: ["quick"], hiddenCount: 0 });
  });

  it("handles no tags and a zero limit", () => {
    expect(previewTags([], 3)).toEqual({ shown: [], hiddenCount: 0 });
    expect(previewTags(["quick"], 0)).toEqual({ shown: [], hiddenCount: 1 });
  });
});
