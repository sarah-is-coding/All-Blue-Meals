import type { MealPlanDayPreview, PlannedMeal } from "../types";

/** Recipe names grouped by day, in date order: what a plan preview shows. */
export function groupMealsByDay(meals: PlannedMeal[]): MealPlanDayPreview[] {
  const byDate = new Map<string, string[]>();
  const inDateOrder = [...meals].sort((a, b) => a.plannedFor.localeCompare(b.plannedFor));
  for (const meal of inDateOrder) {
    const recipes = byDate.get(meal.plannedFor) ?? [];
    recipes.push(meal.recipeTitle);
    byDate.set(meal.plannedFor, recipes);
  }
  return Array.from(byDate, ([dateIso, recipes]) => ({ dateIso, recipes }));
}
