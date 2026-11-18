import { useMemo, useState, type DragEvent, type KeyboardEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  PLANNED_MEAL_DRAG_MIME_TYPE,
  MEAL_TYPE_OPTIONS,
  RECIPE_DETAIL_MEAL_PLANNER_STATE,
} from "../constants";
import type { PlannedMeal, MealPlannerDay, MealType } from "../types";

type MealPlannerCalendarProps = {
  weekLabel: string;
  weekDays: MealPlannerDay[];
  items: PlannedMeal[];
  heading?: string;
  headingTag?: "h1" | "h2";
  centerDayIso?: string | null;
  removingItemId?: string | null;
  movingItemId?: string | null;
  updatingServingsItemId?: string | null;
  onShiftWeek: (weekOffset: number) => void;
  onJumpToCurrentWeek: () => void;
  onMoveItem?: (itemId: string, plannedFor: string, mealType: MealType) => Promise<void>;
  onUpdateItemServings?: (itemId: string, servingsOverride: number | null) => Promise<void>;
  onRemoveItem?: (itemId: string) => Promise<void>;
  /** Picker mode (enabled by passing onSelectSlot): hides item management
   *  UI and the "Search recipes" link, renders
   *  existing items read-only, and makes each slot a selectable target
   *  instead of a drop zone. */
  selectedSlot?: { date: string; mealType: MealType } | null;
  onSelectSlot?: (date: string, mealType: MealType) => void;
};

function getSlotKey(dayIso: string, mealType: MealType): string {
  return `${dayIso}:${mealType}`;
}

function getServingsOverride(
  nextEffectiveServings: number,
  recipeServings: number | null
): number | null {
  if (recipeServings !== null && nextEffectiveServings === recipeServings) {
    return null;
  }
  return nextEffectiveServings;
}

function focusMealDay(card: HTMLElement | null) {
  if (!card) return;
  card.focus({ preventScroll: true });
  card.scrollIntoView?.({ block: "center", inline: "center", behavior: "instant" });
}

export default function MealPlannerCalendar({
  weekLabel,
  weekDays,
  items,
  heading = "Meal Planner",
  headingTag = "h1",
  centerDayIso = null,
  removingItemId = null,
  movingItemId = null,
  updatingServingsItemId = null,
  onShiftWeek,
  onJumpToCurrentWeek,
  onMoveItem,
  onUpdateItemServings,
  onRemoveItem,
  selectedSlot = null,
  onSelectSlot,
}: MealPlannerCalendarProps) {
  const navigate = useNavigate();
  const [dragOverSlotKey, setDragOverSlotKey] = useState<string | null>(null);
  const isPickerMode = Boolean(onSelectSlot);
  const HeadingTag = headingTag;

  const slotMap = useMemo(() => {
    const map = new Map<string, PlannedMeal[]>();

    for (const item of items) {
      const slotKey = getSlotKey(item.plannedFor, item.mealType);
      const slotItems = map.get(slotKey);
      if (slotItems) {
        slotItems.push(item);
      } else {
        map.set(slotKey, [item]);
      }
    }

    return map;
  }, [items]);

  const onDropToSlot = (event: DragEvent<HTMLElement>, dayIso: string, mealType: MealType) => {
    event.preventDefault();
    setDragOverSlotKey(null);

    let plannedMealId = event.dataTransfer.getData(PLANNED_MEAL_DRAG_MIME_TYPE);
    if (!plannedMealId) {
      const plainTextPayload = event.dataTransfer.getData("text/plain");
      if (plainTextPayload.startsWith("meal-plan-item:")) {
        plannedMealId = plainTextPayload.replace("meal-plan-item:", "");
      }
    }
    if (plannedMealId) {
      void onMoveItem?.(plannedMealId, dayIso, mealType);
    }
  };

  const openRecipeDetail = (item: PlannedMeal) => {
    if (!item.recipeId) {
      return;
    }

    navigate(`/app/recipes/${item.recipeId}`, {
      state: {
        ...RECIPE_DETAIL_MEAL_PLANNER_STATE,
        plannedMealId: item.id,
        initialServings: item.effectiveServings,
      },
    });
  };

  return (
    <article className="workspace-card meal-calendar">
      <header className="meal-calendar__header">
        <div>
          <HeadingTag className="meal-calendar__title">{heading}</HeadingTag>
          <p>{weekLabel}</p>
        </div>
        <div className="meal-calendar__actions">
          <button type="button" className="btn btn--ghost" onClick={() => onShiftWeek(-1)}>
            Previous week
          </button>
          <button type="button" className="btn btn--ghost" onClick={onJumpToCurrentWeek}>
            Current week
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => onShiftWeek(1)}>
            Next week
          </button>
        </div>
      </header>

      <div className={`meal-calendar__grid${centerDayIso ? " meal-calendar__grid--center-day" : ""}`}>
        {weekDays.map((day) => (
          <section
            key={day.dateIso}
            className="meal-day"
            ref={day.dateIso === centerDayIso ? focusMealDay : undefined}
            tabIndex={day.dateIso === centerDayIso ? -1 : undefined}
            aria-label={day.dateIso === centerDayIso ? day.fullLabel : undefined}
          >
            <header className="meal-day__header">
              <h2>{day.weekdayShort}</h2>
              <span>{day.monthDayLabel}</span>
            </header>

            <div className="meal-day__slots">
              {MEAL_TYPE_OPTIONS.map((option) => {
                const slotKey = getSlotKey(day.dateIso, option.value);
                const slotItems = slotMap.get(slotKey) ?? [];
                const isDropTarget = dragOverSlotKey === slotKey;
                const isSelected =
                  isPickerMode &&
                  selectedSlot?.date === day.dateIso &&
                  selectedSlot?.mealType === option.value;

                const slotProps = isPickerMode
                  ? {
                      role: "button" as const,
                      tabIndex: 0,
                      "aria-pressed": isSelected,
                      onClick: () => onSelectSlot?.(day.dateIso, option.value),
                      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelectSlot?.(day.dateIso, option.value);
                        }
                      },
                    }
                  : {
                      onDragOver: (event: DragEvent<HTMLElement>) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                      },
                      onDragEnter: () => setDragOverSlotKey(slotKey),
                      onDragLeave: () =>
                        setDragOverSlotKey((current) => (current === slotKey ? null : current)),
                      onDrop: (event: DragEvent<HTMLElement>) =>
                        onDropToSlot(event, day.dateIso, option.value),
                    };

                return (
                  <section
                    key={slotKey}
                    className={`meal-slot${isDropTarget ? " meal-slot--active" : ""}${isSelected ? " meal-slot--selected" : ""}`}
                    aria-label={`${option.label} on ${day.fullLabel}`}
                    {...slotProps}
                  >
                    <div className="meal-slot__title">{option.label}</div>
                    {slotItems.length === 0 ? (
                      <p className="meal-slot__empty">No recipes yet</p>
                    ) : isPickerMode ? (
                      <ul className="meal-slot__items">
                        {slotItems.map((item) => (
                          <li key={item.id} className="meal-chip meal-chip--readonly">
                            <span>{item.recipeTitle}</span>
                            {item.effectiveServings ? (
                              <span className="meal-chip__servings-readout">
                                {item.effectiveServings} servings
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <ul className="meal-slot__items">
                        {slotItems.map((item) => (
                          <li
                            key={item.id}
                            className={`meal-chip${item.recipeId ? " meal-chip--clickable" : ""}${movingItemId === item.id ? " meal-chip--moving" : ""}`}
                            onClick={() => openRecipeDetail(item)}
                            onKeyDown={(event) => {
                              if (event.target !== event.currentTarget) {
                                return;
                              }
                              if (!item.recipeId) {
                                return;
                              }
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                openRecipeDetail(item);
                              }
                            }}
                            role={item.recipeId ? "link" : undefined}
                            tabIndex={item.recipeId ? 0 : undefined}
                            draggable
                            onDragStart={(event) => {
                              event.dataTransfer.setData(PLANNED_MEAL_DRAG_MIME_TYPE, item.id);
                              event.dataTransfer.setData("text/plain", `meal-plan-item:${item.id}`);
                              event.dataTransfer.effectAllowed = "copyMove";
                            }}
                          >
                            <span>{item.recipeTitle}</span>
                            <div className="meal-chip__servings">
                              <span>Servings</span>
                              <div className="servings-stepper servings-stepper--compact">
                                <button
                                  type="button"
                                  className="btn btn--ghost servings-stepper__button"
                                  aria-label={`Decrease servings for ${item.recipeTitle}`}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    if (
                                      updatingServingsItemId === item.id ||
                                      movingItemId === item.id ||
                                      removingItemId === item.id ||
                                      !item.effectiveServings ||
                                      item.effectiveServings <= 1
                                    ) {
                                      return;
                                    }
                                    const nextEffectiveServings = item.effectiveServings - 1;
                                    void onUpdateItemServings?.(
                                      item.id,
                                      getServingsOverride(
                                        nextEffectiveServings,
                                        item.recipeServings
                                      )
                                    );
                                  }}
                                  disabled={
                                    updatingServingsItemId === item.id ||
                                    movingItemId === item.id ||
                                    removingItemId === item.id ||
                                    !item.effectiveServings ||
                                    item.effectiveServings <= 1
                                  }
                                >
                                  -
                                </button>
                                <span className="servings-stepper__value">
                                  {item.effectiveServings ?? "-"}
                                </span>
                                <button
                                  type="button"
                                  className="btn btn--ghost servings-stepper__button"
                                  aria-label={`Increase servings for ${item.recipeTitle}`}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    if (
                                      updatingServingsItemId === item.id ||
                                      movingItemId === item.id ||
                                      removingItemId === item.id
                                    ) {
                                      return;
                                    }
                                    const nextEffectiveServings = Math.max(
                                      1,
                                      (item.effectiveServings ?? 0) + 1
                                    );
                                    void onUpdateItemServings?.(
                                      item.id,
                                      getServingsOverride(
                                        nextEffectiveServings,
                                        item.recipeServings
                                      )
                                    );
                                  }}
                                  disabled={
                                    updatingServingsItemId === item.id ||
                                    movingItemId === item.id ||
                                    removingItemId === item.id
                                  }
                                >
                                  +
                                </button>
                              </div>
                            </div>
                            <button
                              type="button"
                              className="meal-chip__remove"
                              onClick={(event) => {
                                event.stopPropagation();
                                void onRemoveItem?.(item.id);
                              }}
                              disabled={
                                removingItemId === item.id ||
                                movingItemId === item.id ||
                                updatingServingsItemId === item.id
                              }
                              aria-label={`Remove ${item.recipeTitle}`}
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {!isPickerMode ? (
                      <Link
                        className="meal-slot__search-link"
                        to="/app/recipes"
                        state={{ mealSlot: { date: day.dateIso, mealType: option.value } }}
                      >
                        Search recipes
                      </Link>
                    ) : null}
                  </section>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
