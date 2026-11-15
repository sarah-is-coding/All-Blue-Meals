import { act, waitFor } from "@testing-library/react";
import { mealPlanKeys } from "../../../features/meal-plans/queries";
import {
  recipeKeys,
  useRecipe,
  useRecipeActions,
  useRecipeList,
  type RecipeListParams,
} from "../../../features/recipes/queries";
import type { RecipeDetail, RecipeUpsertInput } from "../../../features/recipes/types";
import { createDefaultRecipeListFilters } from "../../../features/recipes/utils/recipeListViewState";
import {
  createTestQueryClient,
  renderHookWithProviders,
  TEST_USER_ID,
} from "../../utils/renderWithProviders";

vi.mock("../../../features/recipes/api", () => ({
  listRecipes: vi.fn(),
  getRecipeById: vi.fn(),
  createRecipe: vi.fn(),
  updateRecipe: vi.fn(),
  rateRecipe: vi.fn(),
  deleteRecipe: vi.fn(),
}));

import {
  createRecipe,
  deleteRecipe,
  getRecipeById,
  listRecipes,
  rateRecipe,
  updateRecipe,
} from "../../../features/recipes/api";

const PARAMS: RecipeListParams = {
  searchTerm: "",
  filters: createDefaultRecipeListFilters(),
  page: 1,
  pageSize: 12,
};

const RECIPE = { id: "r1", title: "Tacos", rating: null } as unknown as RecipeDetail;
const INPUT = { title: "Tacos" } as unknown as RecipeUpsertInput;

const listKey = recipeKeys.list(TEST_USER_ID, PARAMS);
const detailKey = recipeKeys.detail(TEST_USER_ID, "r1");
const weekKey = mealPlanKeys.week(TEST_USER_ID, "2026-05-25");

beforeEach(() => vi.clearAllMocks());

describe("recipe lookups", () => {
  it("useRecipeList loads a page with its total count", async () => {
    vi.mocked(listRecipes).mockResolvedValue({ recipes: [], totalCount: 30 } as never);
    const { result } = renderHookWithProviders(() => useRecipeList(PARAMS));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.totalCount).toBe(30));
    expect(listRecipes).toHaveBeenCalledWith("", PARAMS.filters, { page: 1, pageSize: 12 });
  });

  it("useRecipe returns null for a recipe that doesn't exist", async () => {
    vi.mocked(getRecipeById).mockResolvedValue(null);
    const { result } = renderHookWithProviders(() => useRecipe("missing"));
    expect(result.current.recipe).toBeUndefined();
    await waitFor(() => expect(result.current.recipe).toBeNull());
  });

  it("useRecipe loads nothing without an id", () => {
    const { result } = renderHookWithProviders(() => useRecipe(null));
    expect(result.current).toMatchObject({ recipe: undefined, loading: false });
    expect(getRecipeById).not.toHaveBeenCalled();
  });
});

describe("useRecipeActions", () => {
  function setup() {
    const client = createTestQueryClient();
    client.setQueryData(listKey, { recipes: [], totalCount: 0 });
    client.setQueryData(detailKey, RECIPE);
    client.setQueryData(weekKey, []);
    const { result } = renderHookWithProviders(() => useRecipeActions(), { client });
    return { client, actions: result.current };
  }
  const isStale = (client: ReturnType<typeof createTestQueryClient>, key: readonly unknown[]) =>
    client.getQueryState(key)?.isInvalidated === true;

  it("create refreshes recipe lists", async () => {
    const { client, actions } = setup();
    vi.mocked(createRecipe).mockResolvedValue("r2");

    expect(await act(() => actions.create(INPUT))).toBe("r2");
    expect(isStale(client, listKey)).toBe(true);
    expect(isStale(client, weekKey)).toBe(false);
  });

  it("update refreshes the recipe, lists, and the planner's weeks", async () => {
    const { client, actions } = setup();
    vi.mocked(updateRecipe).mockResolvedValue(undefined);

    await act(() => actions.update("r1", INPUT));

    expect(updateRecipe).toHaveBeenCalledWith("r1", INPUT);
    expect(isStale(client, detailKey)).toBe(true);
    expect(isStale(client, listKey)).toBe(true);
    expect(isStale(client, weekKey)).toBe(true);
  });

  it("rate updates the cached recipe and refreshes lists", async () => {
    const { client, actions } = setup();
    vi.mocked(rateRecipe).mockResolvedValue(undefined);

    await act(() => actions.rate("r1", 4));

    expect(client.getQueryData<RecipeDetail>(detailKey)?.rating).toBe(4);
    expect(isStale(client, listKey)).toBe(true);
  });

  it("remove drops the recipe and refreshes lists and the planner's weeks", async () => {
    const { client, actions } = setup();
    vi.mocked(deleteRecipe).mockResolvedValue(undefined);

    await act(() => actions.remove("r1"));

    expect(client.getQueryData(detailKey)).toBeUndefined();
    expect(isStale(client, listKey)).toBe(true);
    expect(isStale(client, weekKey)).toBe(true);
  });

describe("useRecipeActions — coverage of related cached data", () => {
  it("an edit refreshes every cached recipe-list page and filter, and saved-plan previews", async () => {
    const client = createTestQueryClient();
    const pages: RecipeListParams[] = [
      PARAMS,
      { ...PARAMS, page: 2 },
      { ...PARAMS, searchTerm: "taco" },
      { ...PARAMS, filters: { ...PARAMS.filters, minRating: 4 } },
    ];
    for (const params of pages) {
      client.setQueryData(recipeKeys.list(TEST_USER_ID, params), { recipes: [], totalCount: 0 });
    }
    const previewKey = mealPlanKeys.preview(TEST_USER_ID, "plan-1");
    client.setQueryData(previewKey, [{ dateIso: "2026-05-25", recipes: ["Tacos"] }]);
    vi.mocked(updateRecipe).mockResolvedValue(undefined);
    const { result } = renderHookWithProviders(() => useRecipeActions(), { client });

    await act(() => result.current.update("r1", INPUT));

    for (const params of pages) {
      expect(client.getQueryState(recipeKeys.list(TEST_USER_ID, params))?.isInvalidated).toBe(true);
    }
    // Saved-plan previews list recipe titles too.
    expect(client.getQueryState(previewKey)?.isInvalidated).toBe(true);
  });
});
});
