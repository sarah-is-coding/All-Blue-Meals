import { useCallback, useEffect, useMemo } from "react";
import { queryOptions, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCurrentUserId } from "../../lib/auth/sessionContext";
import { createDateFromIso, getWeekStartIso, shiftWeekStartIso } from "../../lib/utils/dates";
import {
  addMealPlanItem,
  applySavedMealPlan,
  clearWeekPlan,
  deleteMealPlanItem,
  deleteSavedMealPlan,
  listMealPlanItemsForWeek,
  listMealPlanSpans,
  listSavedMealPlans,
  moveMealPlanItem,
  previewSavedMealPlan,
  renameSavedMealPlan,
  savePlanById,
  searchSavedMealPlans,
  updateMealPlanItemServings,
} from "./api";
import type {
  AddMealPlanItemInput,
  MealPlanDayPreview,
  MealPlanItem,
  MealPlanSpan,
  MoveMealPlanItemInput,
  SavedMealPlan,
  UpdateMealPlanItemServingsInput,
} from "./types";

// The only module in meal-plans that talks to TanStack Query. Components use
// the hooks below; cache keys and cache updates live here so the planner,
// the "Add to plan" flow, and sign-in prefetching always agree.

export const mealPlanKeys = {
  all: ["meal-plans"] as const,
  user: (userId: string) => [...mealPlanKeys.all, userId] as const,
  weeks: (userId: string) => [...mealPlanKeys.user(userId), "week"] as const,
  week: (userId: string, weekStartIso: string) =>
    [...mealPlanKeys.weeks(userId), weekStartIso] as const,
  /** Date ranges of every plan, for the past-weeks calendar. */
  spans: (userId: string) => [...mealPlanKeys.user(userId), "spans"] as const,
  saved: (userId: string) => [...mealPlanKeys.user(userId), "saved"] as const,
  savedList: (userId: string) => [...mealPlanKeys.saved(userId), "all"] as const,
  savedSearch: (userId: string, term: string) =>
    [...mealPlanKeys.saved(userId), "search", term] as const,
  /** A plan's meals grouped by day, shown before copying or applying it. */
  preview: (userId: string, planId: string) =>
    [...mealPlanKeys.user(userId), "preview", planId] as const,
};

const errorMessage = (error: Error | null, fallback: string): string | null =>
  error ? error.message || fallback : null;

const weekQuery = (userId: string, weekStartIso: string) =>
  queryOptions({
    queryKey: mealPlanKeys.week(userId, weekStartIso),
    queryFn: () => listMealPlanItemsForWeek(weekStartIso),
  });

const weekOf = (isoDate: string): string => getWeekStartIso(createDateFromIso(isoDate));

/** The week before and the week after, so stepping either way is instant. */
export const adjacentWeeks = (weekStartIso: string): string[] => [
  shiftWeekStartIso(weekStartIso, -1),
  shiftWeekStartIso(weekStartIso, 1),
];

/** Load weeks into the cache in the background (skips weeks that are fresh). */
export async function prefetchMealPlanWeeks(
  client: QueryClient,
  userId: string,
  weekStartIsos: string[]
): Promise<void> {
  await Promise.all(
    weekStartIsos.map((weekStartIso) => client.prefetchQuery(weekQuery(userId, weekStartIso)))
  );
}

/** Load `weekStartIso` first, on its own, then the weeks either side. The week
 *  the user is about to see never shares bandwidth with weeks they might not
 *  view, which matters most on slow mobile connections. */
export async function prefetchWeekThenNeighbours(
  client: QueryClient,
  userId: string,
  weekStartIso: string
): Promise<void> {
  await prefetchMealPlanWeeks(client, userId, [weekStartIso]);
  // If the week itself failed to load, don't pile more requests onto a bad connection.
  if (client.getQueryData(mealPlanKeys.week(userId, weekStartIso)) === undefined) return;
  await prefetchMealPlanWeeks(client, userId, adjacentWeeks(weekStartIso));
}

const NO_ITEMS: MealPlanItem[] = [];

/** A week's meal plan items, from the cache when available. Once the week has
 *  loaded, prefetches the neighbouring weeks so stepping either way is instant. */
export function useMealPlanWeek(weekStartIso: string) {
  const userId = useCurrentUserId();
  const client = useQueryClient();
  const query = useQuery({
    ...weekQuery(userId ?? "", weekStartIso),
    enabled: userId !== null,
  });
  const weekLoaded = query.isSuccess;

  useEffect(() => {
    // Wait for the visible week so neighbours never compete with it.
    if (userId && weekLoaded) {
      void prefetchMealPlanWeeks(client, userId, adjacentWeeks(weekStartIso));
    }
  }, [client, userId, weekStartIso, weekLoaded]);

  return {
    items: query.data ?? NO_ITEMS,
    /** True only while there is nothing to show yet (not during background refreshes). */
    loading: query.isPending,
    error: query.error ? query.error.message || "Failed to load meal plan." : null,
  };
}

/** Changes to the meal plan. Each one saves to the database, then updates every
 *  cached week it affects so all views stay correct without refetching. */
export function useMealPlanActions() {
  const client = useQueryClient();
  const userId = useCurrentUserId();

  return useMemo(() => {
    /** Call after a change is saved, before writing it into the cache. A
     *  request that started before the save could still return the old data,
     *  so cancel every in-flight request for this user:
     *  - weeks already in the cache keep their data, and the stale response
     *    can no longer overwrite the update we're about to write;
     *  - weeks that were loading for the first time are started again, so
     *    they read the database after the change. */
    const settleInFlightRequests = async () => {
      if (!userId) return;
      const queryKey = mealPlanKeys.weeks(userId);
      const firstLoadsInFlight = client
        .getQueryCache()
        .findAll({
          queryKey,
          predicate: (query) =>
            query.state.data === undefined && query.state.fetchStatus === "fetching",
        })
        .map((query) => query.queryKey[3])
        .filter((week): week is string => typeof week === "string");

      await client.cancelQueries({ queryKey });
      if (firstLoadsInFlight.length > 0) {
        void prefetchMealPlanWeeks(client, userId, firstLoadsInFlight);
      }
    };

    const updateWeek = (weekStartIso: string, update: (items: MealPlanItem[]) => MealPlanItem[]) => {
      if (!userId) return;
      // Weeks that aren't cached are left alone; they'll load fresh when opened.
      client.setQueryData<MealPlanItem[]>(mealPlanKeys.week(userId, weekStartIso), (prev) =>
        prev ? update(prev) : prev
      );
    };

    const updateCachedWeeks = (update: (weekStartIso: string, items: MealPlanItem[]) => MealPlanItem[]) => {
      if (!userId) return;
      for (const [key, items] of client.getQueriesData<MealPlanItem[]>({
        queryKey: mealPlanKeys.weeks(userId),
      })) {
        const weekStartIso = key[3];
        if (items && typeof weekStartIso === "string") {
          client.setQueryData(key, update(weekStartIso, items));
        }
      }
    };

    /** Put `item` in the week it now belongs to (in place if already there) and
     *  remove it from any other cached week. */
    const placeItem = (item: MealPlanItem) => {
      const targetWeek = weekOf(item.plannedFor);
      updateCachedWeeks((weekStartIso, items) => {
        const hasItem = items.some((existing) => existing.id === item.id);
        if (weekStartIso !== targetWeek) {
          return hasItem ? items.filter((existing) => existing.id !== item.id) : items;
        }
        return hasItem
          ? items.map((existing) => (existing.id === item.id ? item : existing))
          : [...items, item];
      });
    };

    // Adding to an empty week creates its plan, which the past-weeks calendar shows.
    const refreshSpans = () => {
      if (userId) void client.invalidateQueries({ queryKey: mealPlanKeys.spans(userId) });
    };

    return {
      async addItem(input: AddMealPlanItemInput): Promise<MealPlanItem> {
        const item = await addMealPlanItem(input);
        await settleInFlightRequests();
        placeItem(item);
        refreshSpans();
        return item;
      },

      async removeItem(itemId: string): Promise<void> {
        await deleteMealPlanItem(itemId);
        await settleInFlightRequests();
        updateCachedWeeks((_week, items) => items.filter((item) => item.id !== itemId));
      },

      async moveItem(input: MoveMealPlanItemInput): Promise<MealPlanItem> {
        const moved = await moveMealPlanItem(input);
        await settleInFlightRequests();
        placeItem(moved);
        return moved;
      },

      async updateServings(input: UpdateMealPlanItemServingsInput): Promise<MealPlanItem> {
        const updated = await updateMealPlanItemServings(input);
        await settleInFlightRequests();
        placeItem(updated);
        return updated;
      },

      /** Copy a saved or past plan into the week starting `weekStartIso`.
       *  Multi-week plans add items to the following weeks too. */
      async applyPlan(planId: string, weekStartIso: string, mode: "add" | "replace"): Promise<void> {
        if (mode === "replace") {
          await clearWeekPlan(weekStartIso);
        }
        const newItems = await applySavedMealPlan(planId, weekStartIso);
        await settleInFlightRequests();
        if (mode === "replace") {
          updateWeek(weekStartIso, () => []);
        }
        for (const item of newItems) {
          updateWeek(weekOf(item.plannedFor), (items) => [...items, item]);
        }
        refreshSpans();
      },
    };
  }, [client, userId]);
}

/** For changes made outside the meal planner that affect what it shows
 *  (deleting a saved plan deletes its items; deleting or editing a recipe
 *  changes the titles/servings shown on planned meals). Marks all of the
 *  user's cached meal-plan data stale, so each piece reloads the next time
 *  it's shown. */
export function useInvalidateMealPlanWeeks(): () => Promise<void> {
  const client = useQueryClient();
  const userId = useCurrentUserId();
  return useCallback(async () => {
    if (userId) await client.invalidateQueries({ queryKey: mealPlanKeys.user(userId) });
  }, [client, userId]);
}

// ── Past weeks, saved plans, and previews ───────────────────────────────

const NO_SPANS: MealPlanSpan[] = [];
const NO_SAVED_PLANS: SavedMealPlan[] = [];
const NO_PREVIEW: MealPlanDayPreview[] = [];

/** Every plan's date range, for the past-weeks calendar. */
export function useMealPlanSpans() {
  const userId = useCurrentUserId();
  const query = useQuery({
    queryKey: mealPlanKeys.spans(userId ?? ""),
    queryFn: listMealPlanSpans,
    enabled: userId !== null,
  });
  return {
    spans: query.data ?? NO_SPANS,
    loading: query.isPending,
    error: errorMessage(query.error, "Failed to load plans."),
  };
}

/** All of the user's saved (named) plans. */
export function useSavedMealPlans() {
  const userId = useCurrentUserId();
  const query = useQuery({
    queryKey: mealPlanKeys.savedList(userId ?? ""),
    queryFn: listSavedMealPlans,
    enabled: userId !== null,
  });
  return {
    plans: query.data ?? NO_SAVED_PLANS,
    loading: query.isPending,
    error: errorMessage(query.error, "Failed to load saved plans."),
  };
}

/** Saved plans whose name matches `term` (all of them for an empty term).
 *  Debounce `term` in the caller so each keystroke isn't a request. */
export function useSavedMealPlanSearch(term: string) {
  const userId = useCurrentUserId();
  const query = useQuery({
    queryKey: mealPlanKeys.savedSearch(userId ?? "", term),
    queryFn: () => searchSavedMealPlans(term),
    enabled: userId !== null,
  });
  return {
    results: query.data ?? NO_SAVED_PLANS,
    loading: query.isPending,
    error: errorMessage(query.error, "Failed to load saved plans."),
  };
}

/** A plan's meals by day, or nothing when `planId` is null. */
export function useSavedPlanPreview(planId: string | null) {
  const userId = useCurrentUserId();
  const query = useQuery({
    queryKey: mealPlanKeys.preview(userId ?? "", planId ?? ""),
    queryFn: () => previewSavedMealPlan(planId as string),
    enabled: userId !== null && planId !== null,
  });
  return {
    preview: query.data ?? NO_PREVIEW,
    loading: planId !== null && query.isPending,
    error: errorMessage(query.error, "Failed to load preview."),
  };
}

/** Renaming, deleting, and saving plans. Each saves first, then updates or
 *  refreshes the cached data it affects. */
export function useSavedMealPlanActions() {
  const client = useQueryClient();
  const userId = useCurrentUserId();

  return useMemo(() => {
    /** Refresh related data, but not the saved-plans list itself: that was
     *  just updated precisely, so refetching it would only repeat the work. */
    const refreshAllBut = (savedListKey: readonly unknown[], queryKey: readonly unknown[]) =>
      void client.invalidateQueries({
        queryKey,
        predicate: (query) => JSON.stringify(query.queryKey) !== JSON.stringify(savedListKey),
      });

    return {
      async rename(planId: string, newName: string): Promise<SavedMealPlan> {
        const updated = await renameSavedMealPlan(planId, newName);
        if (userId) {
          client.setQueryData<SavedMealPlan[]>(mealPlanKeys.savedList(userId), (prev) =>
            prev?.map((plan) => (plan.id === updated.id ? updated : plan))
          );
          refreshAllBut(mealPlanKeys.savedList(userId), mealPlanKeys.saved(userId));
        }
        return updated;
      },

      /** Deletes the plan and its meals, so every view of meal-plan data refreshes. */
      async remove(planId: string): Promise<void> {
        await deleteSavedMealPlan(planId);
        if (userId) {
          client.setQueryData<SavedMealPlan[]>(mealPlanKeys.savedList(userId), (prev) =>
            prev?.filter((plan) => plan.id !== planId)
          );
          refreshAllBut(mealPlanKeys.savedList(userId), mealPlanKeys.user(userId));
        }
      },

      /** Name an existing plan so it shows up under saved plans. */
      async saveAs(planId: string, savedName: string): Promise<SavedMealPlan> {
        const saved = await savePlanById(planId, savedName);
        if (userId) void client.invalidateQueries({ queryKey: mealPlanKeys.saved(userId) });
        return saved;
      },
    };
  }, [client, userId]);
}
