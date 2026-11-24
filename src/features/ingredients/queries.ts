import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentUserId } from "../../lib/auth/sessionContext";
import { createIngredient, findIngredientMatches, searchIngredients } from "./api";
import { listIngredientCategories } from "./categories/api";
import { FALLBACK_CATEGORIES } from "./categories/codes";
import type { CategoryInfo, Ingredient, IngredientCategory, IngredientMatch } from "./types";
import { ingredientKey } from "./utils/ingredientKey";

// The only module in ingredients that talks to TanStack Query (see "Data
// loading" in CLAUDE.md).

export const ingredientKeys = {
  all: ["ingredients"] as const,
  user: (userId: string) => [...ingredientKeys.all, userId] as const,
  allMatches: (userId: string) => [...ingredientKeys.user(userId), "matches"] as const,
  matches: (userId: string, keys: string[]) => [...ingredientKeys.allMatches(userId), ...keys] as const,
  categories: (userId: string) => [...ingredientKeys.user(userId), "categories"] as const,
  searches: (userId: string) => [...ingredientKeys.user(userId), "search"] as const,
  search: (userId: string, term: string) => [...ingredientKeys.searches(userId), term] as const,
};

/** How many suggestions a search returns. */
const SEARCH_LIMIT = 8;
const NO_SUGGESTIONS: IngredientMatch[] = [];

/**
 * Catalog ingredients matching what's typed (by name, key, or approved
 * alias). An empty term searches nothing. Each term is its own cache entry,
 * so a slow response for an earlier term can never replace the results for
 * a later one, and searching the same text again is instant.
 */
export function useIngredientSearch(term: string) {
  const userId = useCurrentUserId();
  const normalized = term.trim().toLowerCase();
  const enabled = userId !== null && normalized !== "";
  const query = useQuery({
    queryKey: ingredientKeys.search(userId ?? "", normalized),
    queryFn: ({ signal }) => searchIngredients(normalized, SEARCH_LIMIT, { signal }),
    enabled,
    // While the next term loads, keep showing the last suggestions.
    placeholderData: keepPreviousData,
  });
  return {
    suggestions: enabled ? (query.data ?? NO_SUGGESTIONS) : NO_SUGGESTIONS,
    loading: enabled && query.isFetching,
  };
}

/**
 * Adds an ingredient to the shared catalog (or returns the existing one with
 * that key). A new entry changes what searches and "is this new?" lookups
 * should return, so both are refreshed once it's saved.
 */
export function useCreateIngredient() {
  const client = useQueryClient();
  const userId = useCurrentUserId();
  const mutation = useMutation({
    mutationFn: ({ name, category }: { name: string; category: IngredientCategory }): Promise<Ingredient> =>
      createIngredient(name, category),
    onSuccess: () => {
      if (!userId) return;
      void client.invalidateQueries({ queryKey: ingredientKeys.searches(userId) });
      void client.invalidateQueries({ queryKey: ingredientKeys.allMatches(userId) });
    },
  });
  return { create: mutation.mutateAsync, creating: mutation.isPending };
}

/**
 * Ingredient categories (grocery store departments) in walking order, with
 * their labels. Changed only by migrations, so loaded once per session.
 * Until they load (or if loading fails), the built-in labels are used.
 */
export function useIngredientCategories(): CategoryInfo[] {
  const userId = useCurrentUserId();
  const query = useQuery({
    queryKey: ingredientKeys.categories(userId ?? ""),
    queryFn: listIngredientCategories,
    enabled: userId !== null,
    staleTime: Infinity,
  });
  return query.data && query.data.length > 0 ? query.data : FALLBACK_CATEGORIES;
}

const NO_MATCHES = new Map<string, Ingredient>();

/**
 * Which of these names are already in the catalog (by key or approved alias).
 * `isNew(name)` is true only once the lookup has finished and found nothing,
 * so nothing is labelled "new" while it's still loading.
 */
export function useIngredientMatches(names: ReadonlyArray<string>) {
  const userId = useCurrentUserId();
  const keys = [...new Set(names.map(ingredientKey).filter(Boolean))].sort();
  const query = useQuery({
    queryKey: ingredientKeys.matches(userId ?? "", keys),
    queryFn: () => findIngredientMatches(names),
    enabled: userId !== null && keys.length > 0,
  });
  const matches = query.data ?? NO_MATCHES;
  const loaded = query.isSuccess;
  return {
    matchFor: (name: string): Ingredient | null => matches.get(ingredientKey(name)) ?? null,
    isNew: (name: string): boolean => loaded && Boolean(ingredientKey(name)) && !matches.has(ingredientKey(name)),
    loading: query.isPending && query.fetchStatus !== "idle",
  };
}
