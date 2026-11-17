import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import LoadingModal from "../../../components/feedback/LoadingModal";
import MealPlannerCalendar from "../components/MealPlannerCalendar";
import PlanBrowserPanel from "../components/PlanBrowserPanel";
import {
  createDateFromIso,
  formatWeekRangeLabel,
  getWeekStartIso,
  shiftWeekStartIso,
} from "../../../lib/utils/dates";
import { getWeekDays } from "../utils/weekDays";
import { useMealPlanActions, useMealPlanWeek } from "../queries";
import type { MealType } from "../types";
import {
  getPlannerStartWeek,
  saveMealPlannerViewState,
} from "../utils/mealPlannerViewState";
import { opensSavedPlansTab } from "../utils/savedPlansNavigation";

const isIsoDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

export default function MealPlansPage() {
  const location = useLocation();
  const jumpToDate = (location.state as { jumpToDate?: string } | null)?.jumpToDate;

  const [initialState] = useState(() => {
    if (jumpToDate && isIsoDate(jumpToDate)) {
      return { weekStartIso: getWeekStartIso(createDateFromIso(jumpToDate)) };
    }
    return { weekStartIso: getPlannerStartWeek() };
  });
  const [weekStartIso, setWeekStartIso] = useState(initialState.weekStartIso);
  const week = useMealPlanWeek(weekStartIso);
  const { items } = week;
  const actions = useMealPlanActions();
  // Errors from add/move/remove/etc. The week's load error comes from `week.error`.
  const [actionError, setActionError] = useState<string | null>(null);
  const plannerError = actionError ?? week.error;
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const [movingItemId, setMovingItemId] = useState<string | null>(null);
  const [updatingServingsItemId, setUpdatingServingsItemId] = useState<string | null>(null);

  const weekDays = useMemo(() => getWeekDays(weekStartIso), [weekStartIso]);
  const weekLabel = useMemo(() => formatWeekRangeLabel(weekStartIso), [weekStartIso]);

  const changeWeek = useCallback((nextWeekStartIso: string) => {
    setWeekStartIso(nextWeekStartIso);
    setActionError(null);
  }, []);

  useEffect(() => {
    saveMealPlannerViewState({ weekStartIso });
  }, [weekStartIso]);

  const handleRemoveItem = useCallback(async (itemId: string) => {
    setRemovingItemId(itemId);
    setActionError(null);

    try {
      await actions.removeItem(itemId);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to remove item.");
    } finally {
      setRemovingItemId((currentId) => (currentId === itemId ? null : currentId));
    }
  }, [actions]);

  const handleMoveItem = useCallback(
    async (itemId: string, plannedFor: string, mealType: MealType) => {
      const existingItem = items.find((item) => item.id === itemId);
      if (!existingItem) {
        return;
      }
      if (existingItem.plannedFor === plannedFor && existingItem.mealType === mealType) {
        return;
      }

      setMovingItemId(itemId);
      setActionError(null);

      try {
        await actions.moveItem({ itemId, plannedFor, mealType });
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Failed to move recipe.");
      } finally {
        setMovingItemId((currentId) => (currentId === itemId ? null : currentId));
      }
    },
    [items, actions]
  );

  /** Copy the meals planned between two dates into the viewed week. */
  const handleCopyRange = useCallback(
    async (startIso: string, endIso: string, mode: "add" | "replace") => {
      setActionError(null);
      await actions.copyRange(startIso, endIso, weekStartIso, mode);
    },
    [weekStartIso, actions]
  );

  /** Apply a saved plan starting at the viewed week. */
  const handleApplySavedPlan = useCallback(
    async (savedPlanId: string, mode: "add" | "replace") => {
      setActionError(null);
      await actions.applyPlan(savedPlanId, weekStartIso, mode);
    },
    [weekStartIso, actions]
  );

  const handleUpdateItemServings = useCallback(
    async (itemId: string, servingsOverride: number | null) => {
      const existingItem = items.find((item) => item.id === itemId);
      if (!existingItem || existingItem.servingsOverride === servingsOverride) {
        return;
      }

      setUpdatingServingsItemId(itemId);
      setActionError(null);

      try {
        await actions.updateServings({ itemId, servingsOverride });
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Failed to update servings.");
      } finally {
        setUpdatingServingsItemId((currentId) => (currentId === itemId ? null : currentId));
      }
    },
    [items, actions]
  );

  return (
    <section className="workspace-route meal-planner-route">
      <LoadingModal
        open={week.loading}
        title="Loading meal planner..."
        message="Preparing your calendar and saved meals."
      />
      {plannerError && (
        <p className="meal-planner-route__error error">{plannerError}</p>
      )}

      <div className="meal-planner-layout">
        <MealPlannerCalendar
          weekLabel={weekLabel}
          weekDays={weekDays}
          items={items}
          removingItemId={removingItemId}
          movingItemId={movingItemId}
          updatingServingsItemId={updatingServingsItemId}
          onShiftWeek={(weekOffset) => changeWeek(shiftWeekStartIso(weekStartIso, weekOffset))}
          onJumpToCurrentWeek={() => changeWeek(getWeekStartIso(new Date()))}
          onMoveItem={handleMoveItem}
          onUpdateItemServings={handleUpdateItemServings}
          onRemoveItem={handleRemoveItem}
        />

        <div className="meal-planner-sidebar">
          <PlanBrowserPanel
            currentWeekStartIso={weekStartIso}
            currentWeekHasItems={items.length > 0}
            onJumpToWeek={changeWeek}
            onCopyRange={handleCopyRange}
            onApplySavedPlan={handleApplySavedPlan}
            initialTab={opensSavedPlansTab(location.state) ? "saved" : "calendar"}
          />
        </div>
      </div>
    </section>
  );
}
