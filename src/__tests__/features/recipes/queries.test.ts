import { act, waitFor } from "@testing-library/react";
import { mealPlanKeys } from "../../../features/meal-plans/queries";
import {
  recipeKeys,
  useGenerateRecipes,
  useImportRecipes,
  useRecipe,
  useRecipeActions,
  useRecipeList,
  useRecipeNoteActions,
  useRecipeNotes,
  useRecipeTagFolders,
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
  listRecipeTags: vi.fn(),
  addRecipeNote: vi.fn(),
  updateRecipeNote: vi.fn(),
  deleteRecipeNote: vi.fn(),
  extractRecipesFromText: vi.fn(),
  generateRecipesFromPrompt: vi.fn(),
}));

import {
  addRecipeNote,
  createRecipe,
  deleteRecipe,
  deleteRecipeNote,
  extractRecipesFromText,
  generateRecipesFromPrompt,
  listRecipeNotes,
  listRecipeTags,
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
    // The query's abort signal is passed on, so a list request that's no
    // longer needed (the search moved on) is cancelled.
    expect(listRecipes).toHaveBeenCalledWith(
      "",
      PARAMS.filters,
      { page: 1, pageSize: 12 },
      { signal: expect.any(AbortSignal) }
    );
  });

  it("useRecipeList keeps the previous page while the next one loads", async () => {
    const page1 = { recipes: [{ id: "r1" }], totalCount: 30 } as never;
    vi.mocked(listRecipes).mockResolvedValueOnce(page1);
    const { result, rerender } = renderHookWithProviders((params: RecipeListParams) => useRecipeList(params), {
      initialProps: PARAMS,
    });
    await waitFor(() => expect(result.current.recipes).toEqual([{ id: "r1" }]));

    let resolvePage2: (value: never) => void = () => {};
    vi.mocked(listRecipes).mockReturnValueOnce(new Promise((resolve) => (resolvePage2 = resolve)));
    rerender({ ...PARAMS, page: 2 });

    // Page 1 stays on screen, marked as updating, rather than a loading state.
    expect(result.current).toMatchObject({ loading: false, updating: true, recipes: [{ id: "r1" }] });

    resolvePage2({ recipes: [{ id: "r2" }], totalCount: 30 } as never);
    await waitFor(() => expect(result.current.recipes).toEqual([{ id: "r2" }]));
    expect(result.current.updating).toBe(false);
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

describe("useRecipeTagFolders", () => {
  beforeEach(() => vi.clearAllMocks());

  it("builds the folders from every recipe's tags", async () => {
    vi.mocked(listRecipeTags).mockResolvedValue([["Italian"], ["italian", "dinner"]]);
    const { result } = renderHookWithProviders(() => useRecipeTagFolders());

    await waitFor(() =>
      expect(result.current.folders).toEqual([
        { key: "dinner", label: "dinner", count: 1 },
        { key: "italian", label: "Italian", count: 2 },
      ])
    );
  });

  it("doesn't load when the folders aren't shown", () => {
    const { result } = renderHookWithProviders(() => useRecipeTagFolders(false));
    expect(listRecipeTags).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it("is refreshed whenever recipe lists are (after creating, editing or deleting)", () => {
    expect(recipeKeys.tags(TEST_USER_ID).slice(0, recipeKeys.lists(TEST_USER_ID).length)).toEqual(
      recipeKeys.lists(TEST_USER_ID)
    );
  });
});

// Importing and generating only produce drafts; nothing is saved or cached.
describe("AI recipe drafts", () => {
  const result = { recipes: [], warnings: ["Could not read https://x."] } as never;

  it("useImportRecipes extracts drafts from pasted text", async () => {
    vi.mocked(extractRecipesFromText).mockResolvedValue(result);
    const { result: hook } = renderHookWithProviders(() => useImportRecipes());

    let drafts: unknown;
    await act(async () => {
      drafts = await hook.current.mutateAsync("Tacos: https://x");
    });

    expect(extractRecipesFromText).toHaveBeenCalledWith("Tacos: https://x");
    expect(drafts).toBe(result);
  });

  it("useGenerateRecipes generates drafts from a request", async () => {
    vi.mocked(generateRecipesFromPrompt).mockRejectedValue(new Error("Gemini is rate limited right now."));
    const { result: hook } = renderHookWithProviders(() => useGenerateRecipes());

    await act(async () => {
      await expect(hook.current.mutateAsync("3 quick dinners")).rejects.toThrow("rate limited");
    });
    expect(generateRecipesFromPrompt).toHaveBeenCalledWith("3 quick dinners");
  });
});
