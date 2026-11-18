import type { ReactNode } from "react";
import DateRangePicker from "../../meal-plans/components/DateRangePicker";
import { usePlannedMealsBetween } from "../../meal-plans/queries";

type Props = {
  startIso: string;
  endIso: string;
  onChange: (startIso: string, endIso: string) => void;
  /** Shown under the dates and meal count (the Build button). */
  actions?: ReactNode;
};

/**
 * The grocery page's Calendar tab: pick the dates to shop for and see how
 * many meals are planned on them (the ones the list will be built from).
 */
export default function GroceryCalendarTab({ startIso, endIso, onChange, actions }: Props) {
  const meals = usePlannedMealsBetween(startIso, endIso);

  return (
    <div className="plan-browser__body">
      <DateRangePicker
        startIso={startIso}
        endIso={endIso}
        onChange={onChange}
        mealCount={meals.error ? 0 : meals.items.length}
        countingMeals={meals.loading && !meals.error}
      />

      {meals.error && <p className="error">{meals.error}</p>}

      {actions}
    </div>
  );
}
