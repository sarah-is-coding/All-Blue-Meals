export type MealType = "breakfast" | "lunch" | "dinner";

export type MealPlannerDay = {
  dateIso: string;
  weekdayShort: string;
  monthDayLabel: string;
  fullLabel: string;
};

export type PlannedMeal = {
  id: string;
  recipeId: string | null;
  recipeTitle: string;
  plannedFor: string;
  mealType: MealType;
  servingsOverride: number | null;
  recipeServings: number | null;
  effectiveServings: number | null;
};

export type AddPlannedMealInput = {
  plannedFor: string;
  mealType: MealType;
  recipeId: string;
  servingsOverride: number | null;
};

export type MovePlannedMealInput = {
  itemId: string;
  plannedFor: string;
  mealType: MealType;
};

export type UpdatePlannedMealServingsInput = {
  itemId: string;
  servingsOverride: number | null;
};

export type MealPlanDayPreview = {
  dateIso: string;
  recipes: string[];
};

export type SavedMealPlan = {
  id: string;
  savedName: string;
  /** The dates the plan was saved from (end is always set; day offsets count from start). */
  startDate: string;
  endDate: string;
};
