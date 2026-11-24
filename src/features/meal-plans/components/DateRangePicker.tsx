import { useState, type ReactNode } from "react";
import { useUserPreferences } from "../../../lib/preferences/preferencesContext";
import { isValidIsoDate } from "../../../lib/utils/dates";
import { describeCadence, shiftByCadence } from "../../../lib/utils/planningRange";
import { pickRangeDay } from "../../../lib/utils/pickRangeDay";
import MealDatesCalendar from "./MealDatesCalendar";

// From/To date fields tied to the meal-dates calendar: typing a date moves
// the highlight, tapping days fills the fields. The range can never go
// backwards — moving one end past the other pulls the other end along. The
// arrows move the dates by the user's planning cadence (a week, 2 weeks, a
// month…).

type Props = {
  /** The chosen range; both null while nothing is picked yet. */
  startIso: string | null;
  endIso: string | null;
  onChange: (startIso: string, endIso: string) => void;
  mealCount?: number;
  countingMeals?: boolean;
  /** Optional content between the week arrows. */
  weekNavContent?: ReactNode;
};

export default function DateRangePicker({
  startIso,
  endIso,
  onChange,
  mealCount = 0,
  countingMeals = false,
  weekNavContent,
}: Props) {
  const hasRange = startIso !== null && endIso !== null;
  const showMealCount = hasRange && (countingMeals || mealCount > 0);
  // A pending first tap on the calendar, waiting for the range's last day.
  const [anchor, setAnchor] = useState<string | null>(null);

  // What's being typed; a date is committed once it's complete and real.
  // When the committed range changes from outside (a tap, Clear), the drafts
  // follow — adjusted during render so stale text never paints.
  const [startDraft, setStartDraft] = useState(startIso ?? "");
  const [endDraft, setEndDraft] = useState(endIso ?? "");
  const [prevRange, setPrevRange] = useState({ startIso, endIso });
  if (prevRange.startIso !== startIso || prevRange.endIso !== endIso) {
    setPrevRange({ startIso, endIso });
    setStartDraft(startIso ?? "");
    setEndDraft(endIso ?? "");
    if (startIso === null) setAnchor(null);
  }

  const handleSelectDay = (dateIso: string) => {
    const picked = pickRangeDay(anchor, dateIso);
    setAnchor(picked.anchor);
    onChange(picked.startIso, picked.endIso);
  };

  const { planningCadence } = useUserPreferences();
  const period = describeCadence(planningCadence);
  const shiftRange = (direction: 1 | -1) => {
    if (!hasRange) return;
    const shifted = shiftByCadence({ startIso, endIso }, planningCadence, direction);
    setAnchor(null);
    onChange(shifted.startIso, shifted.endIso);
  };

  const commitStart = (value: string) => {
    setStartDraft(value);
    if (!isValidIsoDate(value)) return;
    setAnchor(null);
    onChange(value, endIso !== null && endIso >= value ? endIso : value);
  };

  const commitEnd = (value: string) => {
    setEndDraft(value);
    if (!isValidIsoDate(value)) return;
    setAnchor(null);
    onChange(startIso !== null && startIso <= value ? startIso : value, value);
  };

  /** Leaving a half-typed date behind puts the committed one back. */
  const resetDraft = (draft: string, committed: string | null, set: (v: string) => void) => {
    if (!isValidIsoDate(draft) || draft !== committed) set(committed ?? "");
  };

  return (
    <div className="date-range-picker">
      <div className="date-range-picker__fields">
        <label className="date-range-picker__field">
          <span>From</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="YYYY-MM-DD"
            maxLength={10}
            value={startDraft}
            onChange={(e) => commitStart(e.target.value)}
            onBlur={() => resetDraft(startDraft, startIso, setStartDraft)}
          />
        </label>
        <label className="date-range-picker__field">
          <span>To</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="YYYY-MM-DD"
            maxLength={10}
            value={endDraft}
            onChange={(e) => commitEnd(e.target.value)}
            onBlur={() => resetDraft(endDraft, endIso, setEndDraft)}
          />
        </label>
      </div>

      <MealDatesCalendar
        rangeStartIso={startIso}
        rangeEndIso={endIso}
        onSelectDay={handleSelectDay}
      />

      <div className="date-range-picker__week-nav">
        <button
          type="button"
          className="btn btn--ghost date-range-picker__week-button"
          onClick={() => shiftRange(-1)}
          disabled={!hasRange}
          aria-label={`Move dates back ${period}`}
        >
          ←
        </button>
        <div className="date-range-picker__week-info">
          {showMealCount && (
            <p className="date-range-picker__meal-count" aria-live="polite">
              {countingMeals
                ? "Counting planned meals…"
                : `${mealCount} planned meal${mealCount === 1 ? "" : "s"} in these dates`}
            </p>
          )}
          {weekNavContent}
        </div>
        <button
          type="button"
          className="btn btn--ghost date-range-picker__week-button"
          onClick={() => shiftRange(1)}
          disabled={!hasRange}
          aria-label={`Move dates forward ${period}`}
        >
          →
        </button>
      </div>
    </div>
  );
}
