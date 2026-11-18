import type { ReactNode } from "react";
import { addDays, createDateFromIso, toIsoDate } from "../../../lib/utils/dates";
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
  const mealCount = meals.items.length;

  /** Move the whole range by `days`, keeping its length. */
  const shiftRange = (days: number) => {
    const shift = (iso: string) => toIsoDate(addDays(createDateFromIso(iso), days));
    onChange(shift(startIso), shift(endIso));
  };

  return (
    <div className="plan-browser__body">
      <DateRangePicker startIso={startIso} endIso={endIso} onChange={onChange} />
      <div className="grocery-source__week-nav">
        <button
          type="button"
          className="btn btn--ghost grocery-source__nav-btn"
          onClick={() => shiftRange(-7)}
          aria-label="Move dates back a week"
        >
          ←
        </button>
        {!meals.error && (meals.loading || mealCount > 0) && (
          <p className="grocery-source__meal-count" aria-live="polite">
            {meals.loading
              ? "Counting planned meals…"
              : `${mealCount} planned meal${mealCount === 1 ? "" : "s"} in these dates`}
          </p>
        )}
        <button
          type="button"
          className="btn btn--ghost grocery-source__nav-btn"
          onClick={() => shiftRange(7)}
          aria-label="Move dates forward a week"
        >
          →
        </button>
      </div>

      {meals.error && <p className="error">{meals.error}</p>}

      {actions}
    </div>
  );
}
