import { filterTagFolders, tagFolders } from "../../../../features/recipes/utils/recipeTagFolders";

describe("tagFolders", () => {
  it("makes one folder per tag, ignoring case, counting recipes, A to Z", () => {
    expect(tagFolders([["Italian", "dinner"], ["italian", "Dessert"], ["dinner"]])).toEqual([
      { key: "dessert", label: "Dessert", count: 1 },
      { key: "dinner", label: "dinner", count: 2 },
      { key: "italian", label: "Italian", count: 2 },
    ]);
  });

  it("names a folder by its most used spelling", () => {
    expect(tagFolders([["italian"], ["italian"], ["Italian"]])[0]!.label).toBe("italian");
  });

  it("counts a recipe once even if it repeats a tag in another case", () => {
    expect(tagFolders([["Pork", "pork"]])).toEqual([{ key: "pork", label: "Pork", count: 1 }]);
  });

  it("tidies spaces and skips blank tags and missing lists", () => {
    expect(tagFolders([["  comfort   food ", ""], null, []])).toEqual([
      { key: "comfort food", label: "comfort food", count: 1 },
    ]);
  });

  it("returns no folders without tags", () => {
    expect(tagFolders([])).toEqual([]);
  });
});

describe("filterTagFolders", () => {
  const folders = tagFolders([["Dinner", "Dessert", "Italian"]]);

  it("keeps folders whose name contains the text, ignoring case", () => {
    expect(filterTagFolders(folders, " DE ").map((folder) => folder.key)).toEqual(["dessert"]);
    expect(filterTagFolders(folders, "d").map((folder) => folder.key)).toEqual(["dessert", "dinner"]);
  });

  it("keeps every folder for empty text", () => {
    expect(filterTagFolders(folders, "  ")).toHaveLength(3);
  });
});
