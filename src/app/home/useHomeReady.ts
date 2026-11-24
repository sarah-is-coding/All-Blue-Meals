import type { PlannedMeal } from "../../features/meal-plans/types";
import { useRecipesSettled } from "../../features/recipes/queries";

const recipeIdsOf = (meals: ReadonlyArray<PlannedMeal>): string[] =>
  meals.flatMap((meal) => (meal.recipeId ? [meal.recipeId] : []));

/**
 * Whether everything the home page shows has finished loading (or failed):
 * the plan, and each meal's recipe and latest note (every HomeMealCard shows
 * both). The sign-in loading modal stays up until this is true,
 * so anything new the home page loads belongs in here too.
 */
export function useHomeReady({
  planLoading,
  meals,
}: {
  planLoading: boolean;
  /** Every meal the page shows, in any section. */
  meals: ReadonlyArray<PlannedMeal>;
}): boolean {
  const shown = recipeIdsOf(meals);
  const recipesSettled = useRecipesSettled({ recipeIds: shown, notesFor: shown });
  return !planLoading && recipesSettled;
}
