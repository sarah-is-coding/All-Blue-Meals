import { useState } from "react";
import { DEFAULT_MEAL_TYPE } from "../constants";
import {
  createDateFromIso,
  formatWeekRangeLabel,
  getWeekStartIso,
  shiftWeekStartIso,
} from "../../../lib/utils/dates";
import { getWeekDays } from "../utils/weekDays";
import { useMealPlanWeek } from "../queries";
import type { MealType } from "../types";
import MealPlannerCalendar from "./MealPlannerCalendar";

type AddToPlanModalProps = {
  recipeTitle: string;
  recipeServings: number | null;
  initialDay?: string;
  initialMealType?: MealType;
  onCancel: () => void;
  onConfirm: (
    plannedFor: string,
    mealType: MealType,
    servingsOverride: number | null
  ) => Promise<void>;
  confirming: boolean;
};

const getDefaultWeekStartIso = (initialDay?: string): string =>
  initialDay
    ? getWeekStartIso(createDateFromIso(initialDay))
    : shiftWeekStartIso(getWeekStartIso(new Date()), 1);

function parsePositiveServings(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.round(parsed);
}

function getServingsOverride(
  selectedServings: number | null,
  recipeServings: number | null
): number | null {
  if (recipeServings === null) {
    return selectedServings;
  }
  if (selectedServings === null || selectedServings === recipeServings) {
    return null;
  }
  return selectedServings;
}

/** Full-calendar "Add to plan" modal — embeds the same MealPlannerCalendar
 *  used on the meal planner page (in picker mode) so you can see what's
 *  already planned that week while choosing where the recipe goes. */
export default function AddToPlanModal({
  recipeTitle,
  recipeServings,
  initialDay,
  initialMealType,
  onCancel,
  onConfirm,
  confirming,
}: AddToPlanModalProps) {
  const [weekStartIso, setWeekStartIso] = useState(() => getDefaultWeekStartIso(initialDay));
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; mealType: MealType } | null>(
    initialDay ? { date: initialDay, mealType: initialMealType ?? DEFAULT_MEAL_TYPE } : null
  );
  const [servingsInput, setServingsInput] = useState(recipeServings ? String(recipeServings) : "");

  const {
    items,
    loading: loadingItems,
    error: itemsError,
  } = useMealPlanWeek(weekStartIso);
  const weekDays = getWeekDays(weekStartIso);
  const weekLabel = formatWeekRangeLabel(weekStartIso);
  const servingsValue = parsePositiveServings(servingsInput);

  const shiftWeek = (nextWeekStartIso: string) => {
    const dayIndex = selectedSlot
      ? weekDays.findIndex((day) => day.dateIso === selectedSlot.date)
      : -1;

    setWeekStartIso(nextWeekStartIso);

    if (dayIndex >= 0 && selectedSlot) {
      const nextDay = getWeekDays(nextWeekStartIso)[dayIndex];
      if (nextDay) {
        setSelectedSlot({ date: nextDay.dateIso, mealType: selectedSlot.mealType });
      }
    }
  };

  return (
    <div className="add-to-plan-modal">
      <div className="add-to-plan-modal__backdrop" onClick={onCancel} />
      <div
        className="add-to-plan-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-label={`Add ${recipeTitle} to your meal plan`}
      >
        <div className="add-to-plan-modal__header">
          <p className="add-to-plan-modal__title">Add to plan</p>
          <p className="add-to-plan-modal__recipe">{recipeTitle}</p>
        </div>

        {itemsError ? <p className="error">{itemsError}</p> : null}
        {loadingItems ? (
          <p className="add-to-plan-modal__loading">Loading your plan for this week…</p>
        ) : null}

        <div className="add-to-plan-modal__calendar">
          <MealPlannerCalendar
            heading="Choose a day and meal"
            headingTag="h2"
            weekLabel={weekLabel}
            weekDays={weekDays}
            items={items}
            onShiftWeek={(weekOffset) => shiftWeek(shiftWeekStartIso(weekStartIso, weekOffset))}
            onJumpToCurrentWeek={() => shiftWeek(getWeekStartIso(new Date()))}
            selectedSlot={selectedSlot}
            onSelectSlot={(date, mealType) => setSelectedSlot({ date, mealType })}
          />
        </div>

        <label className="recipe-field add-to-plan-modal__servings">
          <span>Servings</span>
          <div className="servings-stepper servings-stepper--compact">
            <button
              type="button"
              className="btn btn--ghost servings-stepper__button"
              aria-label="Decrease servings"
              onClick={() =>
                setServingsInput((currentValue) => {
                  const parsed = parsePositiveServings(currentValue);
                  if (parsed === null || parsed <= 1) {
                    return currentValue;
                  }
                  return String(parsed - 1);
                })
              }
              disabled={!servingsValue || servingsValue <= 1}
            >
              -
            </button>
            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={servingsInput}
              onChange={(event) => setServingsInput(event.target.value)}
            />
            <button
              type="button"
              className="btn btn--ghost servings-stepper__button"
              aria-label="Increase servings"
              onClick={() =>
                setServingsInput((currentValue) => {
                  const parsed = parsePositiveServings(currentValue);
                  if (parsed === null) {
                    return "1";
                  }
                  return String(parsed + 1);
                })
              }
            >
              +
            </button>
          </div>
          {recipeServings ? (
            <small className="servings-stepper__hint">Recipe default: {recipeServings}</small>
          ) : null}
        </label>

        <div className="add-to-plan-modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!selectedSlot || confirming}
            onClick={() => {
              if (!selectedSlot) {
                return;
              }
              void onConfirm(
                selectedSlot.date,
                selectedSlot.mealType,
                getServingsOverride(servingsValue, recipeServings)
              );
            }}
          >
            {confirming ? "Adding..." : "Add recipe"}
          </button>
        </div>
      </div>
    </div>
  );
}
