import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUserId } from "../../lib/auth/sessionContext";
import { buildGroceryItemsForRange, buildGroceryItemsForSavedPlan } from "./api";
import type { GroceryItemDraft, GrocerySource } from "./types";

// The only module in grocery that talks to TanStack Query (see "Data
// loading" in CLAUDE.md).

/** Identifies a list by what it's built from (the label isn't part of it). */
const sourceKey = (source: GrocerySource) =>
  source.kind === "range"
    ? (["range", source.startIso, source.endIso] as const)
    : (["saved_plan", source.planId] as const);

const sameSource = (a: GrocerySource, b: GrocerySource) =>
  JSON.stringify(sourceKey(a)) === JSON.stringify(sourceKey(b));

export const groceryKeys = {
  all: ["grocery"] as const,
  user: (userId: string) => [...groceryKeys.all, userId] as const,
  list: (userId: string, source: GrocerySource) =>
    [...groceryKeys.user(userId), "list", ...sourceKey(source)] as const,
};

const NO_ITEMS: GroceryItemDraft[] = [];

/**
 * A grocery list built when the user asks for one (an on-demand query).
 *
 * Every build reads the meals and recipes fresh: they change on other pages,
 * which don't know about grocery lists, so a cached list could be out of date
 * (hence `staleTime: 0`, and building the same source again refetches). While
 * a list builds, none is shown, so each new list starts with nothing ticked.
 */
export function useGroceryList() {
  const userId = useCurrentUserId();
  const [source, setSource] = useState<GrocerySource | null>(null);
  const enabled = userId !== null && source !== null;
  const query = useQuery({
    queryKey: source ? groceryKeys.list(userId ?? "", source) : groceryKeys.user(userId ?? ""),
    queryFn: () => {
      if (!source) return NO_ITEMS;
      return source.kind === "range"
        ? buildGroceryItemsForRange(source.startIso, source.endIso)
        : buildGroceryItemsForSavedPlan(source.planId);
    },
    enabled,
    staleTime: 0,
  });
  const building = enabled && query.isFetching;

  return {
    /** What the current (or building) list is from, or null when none. */
    source,
    /** The built list, or null while none has been asked for or it's building. */
    items: enabled && !building && query.isSuccess ? query.data : null,
    building,
    error: enabled && !building && query.error ? query.error.message || "Failed to generate grocery list." : null,
    /** Changes with each build, so the list's ticks start fresh every time. */
    builtAt: query.dataUpdatedAt,
    build(next: GrocerySource) {
      const again = source !== null && sameSource(source, next);
      setSource(next);
      if (again) void query.refetch();
    },
    /** Drop the list (its dates or plan changed). */
    clear() {
      setSource(null);
    },
  };
}
