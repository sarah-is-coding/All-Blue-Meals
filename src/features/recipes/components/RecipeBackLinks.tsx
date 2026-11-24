import { Link } from "react-router-dom";
import type { MealType } from "../../meal-plans/types";

export type RecipeBackLinksState = {
  from?: "meal-planner" | "home";
  mealSlot?: { date: string; mealType: MealType };
};

type BackLink = { label: string; to: string; state?: object };

const RECIPES: BackLink = { label: "Recipes", to: "/recipes" };
const MEAL_PLANNER: BackLink = { label: "Meal Planner", to: "/meal-plans" };
const HOME: BackLink = { label: "Home", to: "/" };

/**
 * The pages along the path that led to a recipe. Picking a recipe for a
 * planner slot goes planner → recipes list → recipe, so both are offered (the
 * list keeps its "Picking a recipe for…" banner and saved search). A meal
 * opened from the planner or the home page goes back there; anything else
 * came from the recipes list.
 */
function backLinksFor(state: RecipeBackLinksState | null): BackLink[] {
  if (state?.mealSlot) return [{ ...RECIPES, state: { mealSlot: state.mealSlot } }, MEAL_PLANNER];
  if (state?.from === "meal-planner") return [MEAL_PLANNER];
  if (state?.from === "home") return [HOME];
  return [RECIPES];
}

export default function RecipeBackLinks({ state }: { state: RecipeBackLinksState | null }) {
  return (
    <>
      {backLinksFor(state).map((link) => (
        <Link key={link.to} className="btn btn--ghost" to={link.to} state={link.state}>
          Back to {link.label}
        </Link>
      ))}
    </>
  );
}
