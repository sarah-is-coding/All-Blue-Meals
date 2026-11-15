import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { addMealPlanItem } from "../api";
import { MEAL_TYPE_OPTIONS } from "../constants";
import { createDateFromIso, getWeekStartIso } from "../../../lib/utils/dates";
import type { MealType } from "../types";
import AddToPlanModal from "./AddToPlanModal";

const fullDateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
});

type AddToPlanButtonProps = {
  recipeId: string;
  recipeTitle: string;
  recipeServings: number | null;
  initialDay?: string;
  initialMealType?: MealType;
};

/** Standalone "Add to plan" trigger for pages outside the meal planner
 *  (e.g. the recipe detail page). Opens the same weekly calendar used by
 *  the planner itself, scoped to the given day's week when arriving from
 *  a meal slot's "Search recipes" link, otherwise defaulting to *next*
 *  week since the current week is often already planned. */
export default function AddToPlanButton({
  recipeId,
  recipeTitle,
  recipeServings,
  initialDay,
  initialMealType,
}: AddToPlanButtonProps) {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedTo, setAddedTo] = useState<{
    plannedFor: string;
    mealType: MealType;
    dayLabel: string;
  } | null>(null);

  const handleConfirm = async (
    plannedFor: string,
    mealType: MealType,
    servingsOverride: number | null
  ) => {
    setIsAssigning(true);
    setError(null);
    setAddedTo(null);
    try {
      await addMealPlanItem({
        weekStartIso: getWeekStartIso(createDateFromIso(plannedFor)),
        plannedFor,
        mealType,
        recipeId,
        servingsOverride,
      });
      setIsModalOpen(false);
      setAddedTo({
        plannedFor,
        mealType,
        dayLabel: fullDateFormatter.format(createDateFromIso(plannedFor)),
      });
    } catch (assignError) {
      setError(
        assignError instanceof Error ? assignError.message : "Failed to add recipe to plan."
      );
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <div className="add-to-plan-anchor">
      {isModalOpen ? (
        <AddToPlanModal
          recipeTitle={recipeTitle}
          recipeServings={recipeServings}
          initialDay={initialDay}
          initialMealType={initialMealType}
          onCancel={() => setIsModalOpen(false)}
          onConfirm={handleConfirm}
          confirming={isAssigning}
        />
      ) : null}

      <button
        type="button"
        className="btn btn--ghost"
        onClick={() => {
          setError(null);
          setIsModalOpen(true);
        }}
      >
        Add to Plan
      </button>
      {error ? <p className="error">{error}</p> : null}
      {addedTo ? (
        <section
          className="meal-target-popup meal-target-popup--below"
          role="dialog"
          aria-label="Recipe added to plan"
        >
          <p className="meal-target-popup__title">Added to your meal plan.</p>
          <p className="meal-target-popup__recipe">
            Want to see it on {addedTo.dayLabel}&apos;s{" "}
            {MEAL_TYPE_OPTIONS.find((option) => option.value === addedTo.mealType)?.label ??
              addedTo.mealType}
            ?
          </p>
          <div className="meal-target-popup__actions">
            <button type="button" className="btn btn--ghost" onClick={() => setAddedTo(null)}>
              Stay here
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                navigate("/app/meal-plans", { state: { jumpToDate: addedTo.plannedFor } });
                setAddedTo(null);
              }}
            >
              View meal plan
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
