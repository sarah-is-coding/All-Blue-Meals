import type { PlannedMeal } from "../../features/meal-plans/types";
import { useRecipesSettled } from "../../features/recipes/queries";

const recipeIdsOf = (meals: ReadonlyArray<PlannedMeal | null>): string[] =>
  meals.flatMap((meal) => (meal?.recipeId ? [meal.recipeId] : []));

/**
 * Whether everything the home page shows has finished loading (or failed):
 * the plan, each meal's recipe, and the notes previewed on today's and
 * tomorrow's meals. The sign-in loading modal stays up until this is true,
 * so anything new the home page loads belongs in here too.
 */
export function useHomeReady({
  planLoading,
  today,
  tomorrow,
  lastMeal,
}: {
  planLoading: boolean;
  today: ReadonlyArray<PlannedMeal>;
  tomorrow: ReadonlyArray<PlannedMeal>;
  lastMeal: PlannedMeal | null;
}): boolean {
  const previewed = recipeIdsOf([...today, ...tomorrow]);
  const recipesSettled = useRecipesSettled({
    recipeIds: [...previewed, ...recipeIdsOf([lastMeal])],
    notesFor: previewed,
  });
  return !planLoading && recipesSettled;
}
