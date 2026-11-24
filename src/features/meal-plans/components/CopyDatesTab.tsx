import { useMemo, useState } from "react";
import SaveNameForm from "../../../components/forms/SaveNameForm";
import { usePlanningPeriod } from "../../../lib/preferences/usePlanningPeriod";
import { useWeek } from "../../../lib/preferences/useWeek";
import { formatMonthDay } from "../../../lib/utils/dates";
import { usePlannedMealsBetween, useSavedMealPlanActions } from "../queries";
import type { CopyMode } from "../types";
import { groupMealsByDay } from "../utils/groupMealsByDay";
import CopyModeConfirm from "./CopyModeConfirm";
import DateRangePicker from "./DateRangePicker";
import MealPreviewDays from "./MealPreviewDays";

type Props = {
  currentWeekStartIso: string;
  currentWeekHasItems: boolean;
  onJumpToWeek: (dateIso: string) => void;
  /** Copy the meals planned between two dates to the current week. */
  onCopyRange: (startIso: string, endIso: string, mode: CopyMode) => Promise<void>;
};

/** The planner's Calendar tab: pick dates, then copy their meals or save them as a plan. */
export default function CopyDatesTab({
  currentWeekStartIso,
  currentWeekHasItems,
  onJumpToWeek,
  onCopyRange,
}: Props) {
  const period = usePlanningPeriod();
  const week = useWeek();
  // Start with one planning period (the user's cadence: a week, 2 weeks, a
  // month…) from the viewed week, then keep the source independent of the
  // destination. Starting on the viewed week (not, say, the 1st of its month)
  // means the defaults never show "View week" or offer to copy dates onto
  // themselves.
  const [range, setRange] = useState(() => period.from(currentWeekStartIso));

  // Copy flow
  const [copying, setCopying] = useState(false);
  const [copyDone, setCopyDone] = useState(false);
  const [confirmWeek, setConfirmWeek] = useState<string | null>(null);
  const showConfirm = confirmWeek === currentWeekStartIso;
  if (confirmWeek !== null && !showConfirm) setConfirmWeek(null);
  const startLabel = formatMonthDay(currentWeekStartIso);

  // Save-as-plan flow
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [savedLabel, setSavedLabel] = useState<string | null>(null);
  const { saveAs } = useSavedMealPlanActions();

  const handleRangeChange = (startIso: string, endIso: string) => {
    setRange({ startIso, endIso });
    // A new selection starts the flows over.
    setCopyDone(false);
    setConfirmWeek(null);
    setShowSaveInput(false);
    setSavedLabel(null);
  };

  // Preview the meals planned on the chosen dates.
  const previewQuery = usePlannedMealsBetween(range.startIso, range.endIso);
  const preview = useMemo(() => groupMealsByDay(previewQuery.items), [previewQuery.items]);
  const isEmpty = preview.length === 0;
  const canCopy = range.startIso !== currentWeekStartIso && !isEmpty;
  const savedNotice = isEmpty ? null : savedLabel;
  const showSelectionDetails =
    showSaveInput || showConfirm || previewQuery.error || savedNotice;
  const sourceWeek = week.startOf(range.startIso);

  const executeCopy = (mode: CopyMode) => {
    if (!showConfirm || !canCopy) return;
    setConfirmWeek(null);
    setCopying(true);
    setCopyDone(false);
    onCopyRange(range.startIso, range.endIso, mode)
      .then(() => setCopyDone(true))
      .catch(() => { /* parent surfaces the error */ })
      .finally(() => setCopying(false));
  };

  // The form shows save errors itself.
  const handleSave = async (name: string) => {
    const saved = await saveAs(name, range.startIso, range.endIso);
    setSavedLabel(`Saved as "${saved.savedName}"`);
    setShowSaveInput(false);
  };

  return (
    <div className="plan-browser__body">
      <DateRangePicker
        startIso={range.startIso}
        endIso={range.endIso}
        onChange={handleRangeChange}
        mealCount={previewQuery.error ? 0 : previewQuery.items.length}
        weekNavContent={sourceWeek !== currentWeekStartIso && (
          <button
            type="button"
            className="plan-browser__range-action"
            onClick={() => onJumpToWeek(range.startIso)}
          >
            View week
          </button>
        )}
      />

      {/* Keep the actions above the meal preview so they stay easy to reach. */}
      {showSelectionDetails && (
        <div className="plan-browser__selection">
          {savedNotice && (
            <p className="plan-browser__save-done">✓ {savedNotice}</p>
          )}
          {showSaveInput && (
            <SaveNameForm
              placeholder="Meal plan name"
              onSave={handleSave}
              onCancel={() => setShowSaveInput(false)}
              errorFallback="Failed to save plan."
            />
          )}

          {showConfirm && (
            <CopyModeConfirm
              startLabel={startLabel}
              hasMeals={currentWeekHasItems}
              onChoose={executeCopy}
              onCancel={() => setConfirmWeek(null)}
            />
          )}

          {previewQuery.error && <p className="error">{previewQuery.error}</p>}
        </div>
      )}

      {!showConfirm && !showSaveInput && (
        <div className="plan-browser__calendar-actions" role="group" aria-label="Meal plan actions">
          <button
            type="button"
            className="btn btn--primary btn--small"
            disabled={!canCopy || copying || copyDone}
            onClick={() => setConfirmWeek(currentWeekStartIso)}
          >
            {copying ? "Applying…" : copyDone ? "✓ Applied" : `Apply from ${startLabel}`}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--small"
            disabled={isEmpty || savedLabel !== null}
            onClick={() => setShowSaveInput(true)}
          >
            Save plan
          </button>
        </div>
      )}

      {!previewQuery.loading && !isEmpty && (
        <>
          <h3 className="plan-browser__preview-heading">Meals in these dates</h3>
          <MealPreviewDays preview={preview} />
        </>
      )}
    </div>
  );
}
