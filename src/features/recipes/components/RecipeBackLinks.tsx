import { Link } from "react-router-dom";
import type { MealType } from "../../meal-plans/types";

export type RecipeBackLinksState = {
  from?: "meal-planner";
  mealSlot?: { date: string; mealType: MealType };
};

/**
 * Back links along the path that led to a recipe. Picking a recipe for a
 * planner slot goes planner → recipes list → recipe, so both are offered; the
 * list keeps its "Picking a recipe for…" banner (and its saved search). A meal
 * opened straight from the planner only came from the planner.
 */
export default function RecipeBackLinks({ state }: { state: RecipeBackLinksState | null }) {
  const isFromMealPlanner = state?.from === "meal-planner";
  const pickingForSlot = state?.mealSlot;

  return (
    <>
      {!isFromMealPlanner || pickingForSlot ? (
        <Link
          className="btn btn--ghost"
          to="/app/recipes"
          state={pickingForSlot ? { mealSlot: pickingForSlot } : undefined}
        >
          Back to Recipes
        </Link>
      ) : null}
      {isFromMealPlanner ? (
        <Link className="btn btn--ghost" to="/app/meal-plans">
          Back to Meal Planner
        </Link>
      ) : null}
    </>
  );
}
