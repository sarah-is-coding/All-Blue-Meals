import {
  createDefaultRecipeListFilters,
  loadRecipeListViewState,
  saveRecipeListViewState,
} from "../../../../features/recipes/utils/recipeListViewState";

describe("recipeListViewState minRating", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("defaults minRating to 0", () => {
    expect(createDefaultRecipeListFilters().minRating).toBe(0);
  });

  it("round-trips a valid minRating value", () => {
    saveRecipeListViewState({
      searchInput: "",
      filters: { ...createDefaultRecipeListFilters(), minRating: 4 },
      currentPage: 1,
      view: "list",
      openTag: null,
    });

    expect(loadRecipeListViewState().filters.minRating).toBe(4);
  });

  it("clamps an out-of-range or invalid minRating back to 0", () => {
    window.sessionStorage.setItem(
      "planmymeals:recipes:list-view",
      JSON.stringify({
        searchInput: "",
        filters: { ...createDefaultRecipeListFilters(), minRating: 9 },
        currentPage: 1,
      })
    );
    expect(loadRecipeListViewState().filters.minRating).toBe(0);

    window.sessionStorage.setItem(
      "planmymeals:recipes:list-view",
      JSON.stringify({
        searchInput: "",
        filters: { ...createDefaultRecipeListFilters(), minRating: "not-a-number" },
        currentPage: 1,
      })
    );
    expect(loadRecipeListViewState().filters.minRating).toBe(0);
  });
});

describe("recipeListViewState view", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("defaults to the list view with no open folder", () => {
    expect(loadRecipeListViewState()).toMatchObject({ view: "list", openTag: null });
  });

  it("remembers the tag folders view and its open folder (lowercase)", () => {
    saveRecipeListViewState({
      searchInput: "",
      filters: createDefaultRecipeListFilters(),
      currentPage: 1,
      view: "tags",
      openTag: "Italian",
    });
    expect(loadRecipeListViewState()).toMatchObject({ view: "tags", openTag: "italian" });
  });

  it("falls back to the list view for an unknown view, and ignores a blank folder", () => {
    window.sessionStorage.setItem(
      "planmymeals:recipes:list-view",
      JSON.stringify({ searchInput: "", filters: {}, currentPage: 1, view: "grid", openTag: "  " })
    );
    expect(loadRecipeListViewState()).toMatchObject({ view: "list", openTag: null });
  });
});
