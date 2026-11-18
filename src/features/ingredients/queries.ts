import { useQuery } from "@tanstack/react-query";
import { useCurrentUserId } from "../../lib/auth/sessionContext";
import { findIngredientMatches } from "./api";
import { listIngredientCategories } from "./categories/api";
import { FALLBACK_CATEGORIES } from "./categories/codes";
import type { CategoryInfo, Ingredient } from "./types";
import { ingredientKey } from "./utils/ingredientKey";

// The only module in ingredients that talks to TanStack Query (see "Data
// loading" in CLAUDE.md).

export const ingredientKeys = {
  all: ["ingredients"] as const,
  user: (userId: string) => [...ingredientKeys.all, userId] as const,
  matches: (userId: string, keys: string[]) => [...ingredientKeys.user(userId), "matches", ...keys] as const,
  categories: (userId: string) => [...ingredientKeys.user(userId), "categories"] as const,
};

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
