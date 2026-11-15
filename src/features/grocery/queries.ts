import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentUserId } from "../../lib/auth/sessionContext";
import {
  deleteGroceryList,
  getGroceryList,
  listSavedGroceryLists,
  renameGroceryList,
  saveGroceryList,
  toggleGroceryItem,
  uncheckAllGroceryItems,
} from "./api";
import type { GroceryItemDraft, GroceryList, GroceryListSummary } from "./types";

// The only module in grocery that talks to TanStack Query (see "Data loading"
// in CLAUDE.md). Components use these hooks; cache keys and updates live here.

export const groceryKeys = {
  all: ["grocery"] as const,
  user: (userId: string) => [...groceryKeys.all, userId] as const,
  savedLists: (userId: string) => [...groceryKeys.user(userId), "saved-lists"] as const,
  list: (userId: string, listId: string) =>
    [...groceryKeys.user(userId), "list", listId] as const,
};

const errorMessage = (error: Error | null, fallback: string): string | null =>
  error ? error.message || fallback : null;

const NO_LISTS: GroceryListSummary[] = [];

/** The user's saved grocery lists (titles and dates, without items). */
export function useSavedGroceryLists() {
  const userId = useCurrentUserId();
  const query = useQuery({
    queryKey: groceryKeys.savedLists(userId ?? ""),
    queryFn: listSavedGroceryLists,
    enabled: userId !== null,
  });
  return {
    lists: query.data ?? NO_LISTS,
    loading: query.isPending,
    error: errorMessage(query.error, "Failed to load lists."),
  };
}

/** One grocery list with its items, or nothing when `listId` is null. */
export function useGroceryList(listId: string | null) {
  const userId = useCurrentUserId();
  const query = useQuery({
    queryKey: groceryKeys.list(userId ?? "", listId ?? ""),
    queryFn: () => getGroceryList(listId as string),
    enabled: userId !== null && listId !== null,
  });
  return {
    list: query.data ?? null,
    loading: listId !== null && query.isPending,
    error: errorMessage(query.error, "Failed to load list."),
  };
}

/** Changes to grocery lists. Each saves first, then updates the cached lists
 *  it affects so every view stays correct without refetching. */
export function useGroceryListActions() {
  const client = useQueryClient();
  const userId = useCurrentUserId();

  return useMemo(() => {
    const updateList = (listId: string, update: (list: GroceryList) => GroceryList) => {
      if (!userId) return;
      client.setQueryData<GroceryList | null>(groceryKeys.list(userId, listId), (prev) =>
        prev ? update(prev) : prev
      );
    };
    const updateSummaries = (update: (lists: GroceryListSummary[]) => GroceryListSummary[]) => {
      if (!userId) return;
      client.setQueryData<GroceryListSummary[]>(groceryKeys.savedLists(userId), (prev) =>
        prev ? update(prev) : prev
      );
    };

    return {
      async save(
        title: string,
        mealPlanId: string | null,
        items: GroceryItemDraft[]
      ): Promise<GroceryList> {
        const list = await saveGroceryList(title, mealPlanId, items);
        if (userId) {
          client.setQueryData(groceryKeys.list(userId, list.id), list);
          void client.invalidateQueries({ queryKey: groceryKeys.savedLists(userId) });
        }
        return list;
      },

      async toggleItem(listId: string, itemId: string, isChecked: boolean): Promise<void> {
        await toggleGroceryItem(itemId, isChecked);
        updateList(listId, (list) => ({
          ...list,
          items: list.items.map((item) => (item.id === itemId ? { ...item, isChecked } : item)),
        }));
      },

      async uncheckAll(listId: string): Promise<void> {
        await uncheckAllGroceryItems(listId);
        updateList(listId, (list) => ({
          ...list,
          items: list.items.map((item) => ({ ...item, isChecked: false })),
        }));
      },

      async rename(listId: string, newName: string): Promise<GroceryListSummary> {
        const updated = await renameGroceryList(listId, newName);
        updateSummaries((lists) => lists.map((list) => (list.id === updated.id ? updated : list)));
        updateList(listId, (list) => ({ ...list, title: updated.title }));
        return updated;
      },

      async remove(listId: string): Promise<void> {
        await deleteGroceryList(listId);
        updateSummaries((lists) => lists.filter((list) => list.id !== listId));
        if (userId) client.removeQueries({ queryKey: groceryKeys.list(userId, listId) });
      },
    };
  }, [client, userId]);
}
