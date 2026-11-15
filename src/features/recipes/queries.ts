import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentUserId } from "../../lib/auth/sessionContext";
import { useInvalidateMealPlanWeeks } from "../meal-plans/queries";
import {
  createRecipe,
  deleteRecipe,
  getRecipeById,
  listRecipes,
  rateRecipe,
  updateRecipe,
} from "./api";
import type { RecipeDetail, RecipeListFilters, RecipeSummary, RecipeUpsertInput } from "./types";

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
  detail: (userId: string, recipeId: string) =>
    [...recipeKeys.user(userId), "detail", recipeId] as const,
};

const errorMessage = (error: Error | null, fallback: string): string | null =>
  error ? error.message || fallback : null;

const NO_RECIPES: RecipeSummary[] = [];

/** One page of the recipe list for a search and set of filters. */
export function useRecipeList(params: RecipeListParams) {
  const userId = useCurrentUserId();
  const query = useQuery({
    queryKey: recipeKeys.list(userId ?? "", params),
    queryFn: () =>
      listRecipes(params.searchTerm, params.filters, {
        page: params.page,
        pageSize: params.pageSize,
      }),
    enabled: userId !== null,
  });
  return {
    recipes: query.data?.recipes ?? NO_RECIPES,
    totalCount: query.data?.totalCount ?? 0,
    loading: query.isPending,
    error: errorMessage(query.error, "Failed to load recipes."),
  };
}

/** One recipe with its ingredients. `recipe` is null when it doesn't exist
 *  (or isn't the user's) and undefined while loading. */
export function useRecipe(recipeId: string | null) {
  const userId = useCurrentUserId();
  const query = useQuery({
    queryKey: recipeKeys.detail(userId ?? "", recipeId ?? ""),
    queryFn: () => getRecipeById(recipeId as string),
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
