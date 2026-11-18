import { act, waitFor } from "@testing-library/react";
import { mealPlanKeys } from "../../../features/meal-plans/queries";
import {
  recipeKeys,
  useRecipe,
  useRecipeActions,
  useRecipeList,
  useRecipeNoteActions,
  useRecipeNotes,
  type RecipeListParams,
} from "../../../features/recipes/queries";
import type { RecipeDetail, RecipeNote, RecipeUpsertInput } from "../../../features/recipes/types";
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
  listRecipeNotes: vi.fn(),
  addRecipeNote: vi.fn(),
  updateRecipeNote: vi.fn(),
  deleteRecipeNote: vi.fn(),
}));

import {
  addRecipeNote,
  createRecipe,
  deleteRecipe,
  deleteRecipeNote,
  listRecipeNotes,
  updateRecipeNote,
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

// ─────────────────────────────────────────────────────────────
// Recipe notes
// ─────────────────────────────────────────────────────────────
const note = (id: string, body: string): RecipeNote => ({
  id,
  body,
  createdAt: "2026-11-03T18:20:00Z",
  updatedAt: "2026-11-03T18:20:00Z",
});

describe("useRecipeNotes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads a recipe's notes", async () => {
    vi.mocked(listRecipeNotes).mockResolvedValue([note("n1", "Good")]);
    const { result } = renderHookWithProviders(() => useRecipeNotes("r1"));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.notes).toEqual([note("n1", "Good")]));
    expect(listRecipeNotes).toHaveBeenCalledWith("r1");
  });

  it("reports a load error", async () => {
    vi.mocked(listRecipeNotes).mockRejectedValue(new Error("offline"));
    const { result } = renderHookWithProviders(() => useRecipeNotes("r1"));
    await waitFor(() => expect(result.current.error).toBe("offline"));
  });

  it("doesn't load without a recipe", () => {
    const { result } = renderHookWithProviders(() => useRecipeNotes(null));
    expect(listRecipeNotes).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });
});

describe("useRecipeNoteActions", () => {
  beforeEach(() => vi.clearAllMocks());

  const setup = () => {
    const client = createTestQueryClient();
    client.setQueryData(recipeKeys.notes(TEST_USER_ID, "r1"), [note("n1", "First")]);
    const { result } = renderHookWithProviders(() => useRecipeNoteActions("r1"), { client });
    const cached = () => client.getQueryData<RecipeNote[]>(recipeKeys.notes(TEST_USER_ID, "r1"));
    return { result, cached };
  };

  it("adds a saved note to the top of the cached list", async () => {
    vi.mocked(addRecipeNote).mockResolvedValue(note("n2", "Second"));
    const { result, cached } = setup();

    await act(() => result.current.add("Second"));

    expect(addRecipeNote).toHaveBeenCalledWith("r1", "Second");
    expect(cached()?.map((n) => n.id)).toEqual(["n2", "n1"]);
  });

  it("replaces an edited note", async () => {
    vi.mocked(updateRecipeNote).mockResolvedValue(note("n1", "Edited"));
    const { result, cached } = setup();

    await act(() => result.current.edit("n1", "Edited"));

    expect(cached()?.[0]?.body).toBe("Edited");
  });

  it("removes a deleted note", async () => {
    vi.mocked(deleteRecipeNote).mockResolvedValue();
    const { result, cached } = setup();

    await act(() => result.current.remove("n1"));

    expect(deleteRecipeNote).toHaveBeenCalledWith("n1");
    expect(cached()).toEqual([]);
  });

  it("leaves the cache alone when saving fails", async () => {
    vi.mocked(addRecipeNote).mockRejectedValue(new Error("denied"));
    const { result, cached } = setup();

    await expect(act(() => result.current.add("Second"))).rejects.toThrow("denied");
    expect(cached()?.map((n) => n.id)).toEqual(["n1"]);
  });
});
