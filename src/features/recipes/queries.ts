import { useMemo } from "react";
import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentUserId } from "../../lib/auth/sessionContext";
import { useInvalidateMealPlanWeeks } from "../meal-plans/queries";
import {
  addRecipeNote,
  createRecipe,
  deleteRecipe,
  deleteRecipeNote,
  extractRecipesFromText,
  generateRecipesFromPrompt,
  getRecipeById,
  listRecipeNotes,
  listRecipeTags,
  listRecipes,
  rateRecipe,
  updateRecipe,
  updateRecipeNote,
} from "./api";
import type { RecipeDetail, RecipeListFilters, RecipeNote, RecipeSummary, RecipeUpsertInput } from "./types";
import { tagFolders, type RecipeTagFolder } from "./utils/recipeTagFolders";

// The only module in recipes that talks to TanStack Query (see "Data loading"
// in CLAUDE.md). Components use these hooks; cache keys and updates live here.

export type RecipeListParams = {
  searchTerm: string;
  filters: RecipeListFilters;
  page: number;
  pageSize: number;
};

export const recipeKeys = {
  all: ["recipes"] as const,
  user: (userId: string) => [...recipeKeys.all, userId] as const,
  lists: (userId: string) => [...recipeKeys.user(userId), "list"] as const,
  list: (userId: string, params: RecipeListParams) => [...recipeKeys.lists(userId), params] as const,
  // Under lists, so whatever refreshes the lists (create, update, delete) refreshes tags too.
  tags: (userId: string) => [...recipeKeys.lists(userId), "tags"] as const,
  detail: (userId: string, recipeId: string) =>
    [...recipeKeys.user(userId), "detail", recipeId] as const,
  notes: (userId: string, recipeId: string) =>
    [...recipeKeys.user(userId), "notes", recipeId] as const,
};

const errorMessage = (error: Error | null, fallback: string): string | null =>
  error ? error.message || fallback : null;

const NO_RECIPES: RecipeSummary[] = [];

/** One page of the recipe list for a search and set of filters. Pass
 *  `enabled: false` when the page isn't showing a list (e.g. tag folders). */
export function useRecipeList(params: RecipeListParams, enabled = true) {
  const userId = useCurrentUserId();
  const query = useQuery({
    queryKey: recipeKeys.list(userId ?? "", params),
    queryFn: ({ signal }) =>
      listRecipes(
        params.searchTerm,
        params.filters,
        { page: params.page, pageSize: params.pageSize },
        { signal }
      ),
    enabled: userId !== null && enabled,
    // A new search, filter, or page keeps showing the current page until the
    // next one arrives, instead of blanking the list (tanstack-query.md §6).
    placeholderData: keepPreviousData,
  });
  return {
    recipes: query.data?.recipes ?? NO_RECIPES,
    totalCount: query.data?.totalCount ?? 0,
    /** Nothing to show yet (the very first load). */
    loading: enabled && query.isPending,
    /** Showing the previous results while the next ones load. */
    updating: enabled && query.isPlaceholderData,
    error: errorMessage(query.error, "Failed to load recipes."),
  };
}

const NO_FOLDERS: RecipeTagFolder[] = [];

/** The "Tag folders" view: a folder per tag (case ignored) with its count. */
export function useRecipeTagFolders(enabled = true) {
  const userId = useCurrentUserId();
  const query = useQuery({
    queryKey: recipeKeys.tags(userId ?? ""),
    queryFn: async () => tagFolders(await listRecipeTags()),
    enabled: userId !== null && enabled,
  });
  return {
    folders: query.data ?? NO_FOLDERS,
    loading: enabled && query.isPending,
    error: errorMessage(query.error, "Failed to load tags."),
  };
}

// Shared by the single-recipe hooks and useRecipesSettled, so they use one cache entry.
const recipeDetailQuery = (userId: string, recipeId: string) => ({
  queryKey: recipeKeys.detail(userId, recipeId),
  queryFn: () => getRecipeById(recipeId),
});

const recipeNotesQuery = (userId: string, recipeId: string) => ({
  queryKey: recipeKeys.notes(userId, recipeId),
  queryFn: () => listRecipeNotes(recipeId),
});

/** One recipe with its ingredients. `recipe` is null when it doesn't exist
 *  (or isn't the user's) and undefined while loading. */
export function useRecipe(recipeId: string | null) {
  const userId = useCurrentUserId();
  const query = useQuery({
    ...recipeDetailQuery(userId ?? "", recipeId ?? ""),
    enabled: userId !== null && recipeId !== null,
  });
  return {
    recipe: query.data as RecipeDetail | null | undefined,
    loading: recipeId !== null && query.isPending,
    error: errorMessage(query.error, "Failed to load recipe."),
  };
}

/** Changes to recipes. Each saves first, then refreshes the cached data it
 *  affects: the recipe itself, recipe lists, and planner weeks (which show
 *  recipe titles and servings). */
/** Turns pasted notes and links into recipe drafts (the import edge
 *  function). Nothing is saved, so no cached data changes. */
export function useImportRecipes() {
  return useMutation({ mutationFn: (text: string) => extractRecipesFromText(text) });
}

/** Generates recipe drafts from a request. Nothing is saved. */
export function useGenerateRecipes() {
  return useMutation({ mutationFn: (prompt: string) => generateRecipesFromPrompt(prompt) });
}

export function useRecipeActions() {
  const client = useQueryClient();
  const userId = useCurrentUserId();
  const invalidateMealPlanWeeks = useInvalidateMealPlanWeeks();

  return useMemo(() => {
    const refreshLists = () => {
      if (userId) void client.invalidateQueries({ queryKey: recipeKeys.lists(userId) });
    };

    return {
      async create(input: RecipeUpsertInput): Promise<string> {
        const recipeId = await createRecipe(input);
        refreshLists();
        return recipeId;
      },

      async update(recipeId: string, input: RecipeUpsertInput): Promise<void> {
        await updateRecipe(recipeId, input);
        if (userId) void client.invalidateQueries({ queryKey: recipeKeys.detail(userId, recipeId) });
        refreshLists();
        void invalidateMealPlanWeeks();
      },

      async rate(recipeId: string, rating: number | null): Promise<void> {
        await rateRecipe(recipeId, rating);
        if (userId) {
          client.setQueryData<RecipeDetail | null>(recipeKeys.detail(userId, recipeId), (prev) =>
            prev ? { ...prev, rating } : prev
          );
        }
        // Lists show ratings and can filter by them.
        refreshLists();
      },

      async remove(recipeId: string): Promise<void> {
        await deleteRecipe(recipeId);
        if (userId) client.removeQueries({ queryKey: recipeKeys.detail(userId, recipeId) });
        refreshLists();
        void invalidateMealPlanWeeks();
      },
    };
  }, [client, userId, invalidateMealPlanWeeks]);
}

const NO_NOTES: RecipeNote[] = [];

/** A recipe's notes, newest first. */
export function useRecipeNotes(recipeId: string | null) {
  const userId = useCurrentUserId();
  const query = useQuery({
    ...recipeNotesQuery(userId ?? "", recipeId ?? ""),
    enabled: userId !== null && recipeId !== null,
  });
  return {
    notes: query.data ?? NO_NOTES,
    loading: recipeId !== null && query.isPending,
    error: errorMessage(query.error, "Failed to load notes."),
  };
}

/**
 * Whether these recipes, and the notes of `notesFor`, have all finished
 * loading (or failed), for a page that waits until everything it shows is in
 * (e.g. the home page after sign-in). Loads them into the same cache entries
 * as useRecipe / useRecipeNotes, so nothing is fetched twice.
 */
export function useRecipesSettled({
  recipeIds,
  notesFor = [],
}: {
  recipeIds: ReadonlyArray<string>;
  notesFor?: ReadonlyArray<string>;
}): boolean {
  const userId = useCurrentUserId();
  return useQueries({
    queries: userId
      ? [
          ...[...new Set(recipeIds)].map((id) => recipeDetailQuery(userId, id)),
          ...[...new Set(notesFor)].map((id) => recipeNotesQuery(userId, id)),
        ]
      : [],
    combine: (results) => results.every((result) => !result.isPending),
  });
}

/** Adding, editing and deleting a recipe's notes. Each saves first, then
 *  updates the cached list (after cancelling a load in flight, so a stale
 *  response can't overwrite the change). */
export function useRecipeNoteActions(recipeId: string) {
  const client = useQueryClient();
  const userId = useCurrentUserId();

  return useMemo(() => {
    const updateCache = async (change: (notes: RecipeNote[]) => RecipeNote[]) => {
      if (!userId) return;
      const queryKey = recipeKeys.notes(userId, recipeId);
      await client.cancelQueries({ queryKey });
      client.setQueryData<RecipeNote[]>(queryKey, (prev) => change(prev ?? []));
    };

    return {
      /** Saves the note and returns it, as saved. */
      async add(body: string): Promise<RecipeNote> {
        const note = await addRecipeNote(recipeId, body);
        await updateCache((notes) => [note, ...notes]);
        return note;
      },

      async edit(noteId: string, body: string): Promise<void> {
        const note = await updateRecipeNote(noteId, body);
        await updateCache((notes) => notes.map((existing) => (existing.id === noteId ? note : existing)));
      },

      async remove(noteId: string): Promise<void> {
        await deleteRecipeNote(noteId);
        await updateCache((notes) => notes.filter((existing) => existing.id !== noteId));
      },
    };
  }, [client, userId, recipeId]);
}
