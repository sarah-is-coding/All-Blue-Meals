import { useMemo, useState } from "react";
import SaveNameForm from "../../../components/forms/SaveNameForm";
import { createDateFromIso, formatMonthDay, getWeekEndIso, getWeekStartIso } from "../../../lib/utils/dates";
import { usePlannedMealsBetween, useSavedMealPlanActions } from "../queries";
import type { CopyMode } from "../types";
import { groupMealsByDay } from "../utils/groupMealsByDay";
import CopyModeConfirm from "./CopyModeConfirm";
import DateRangePicker from "./DateRangePicker";
import MealPreviewDays from "./MealPreviewDays";

type Props = {
  currentWeekStartIso: string;
  currentWeekHasItems: boolean;
  onJumpToWeek: (weekStartIso: string) => void;
  /** Copy the meals planned between two dates to the current week. */
  onCopyRange: (startIso: string, endIso: string, mode: CopyMode) => Promise<void>;
};

type DateRange = { startIso: string; endIso: string };

/** The planner's Calendar tab: pick dates, then copy their meals or save them as a plan. */
export default function CopyDatesTab({
  currentWeekStartIso,
  currentWeekHasItems,
  onJumpToWeek,
  onCopyRange,
}: Props) {
  // Start with the viewed week, then keep the source independent of the destination.
  const [range, setRange] = useState<DateRange | null>(() => ({
    startIso: currentWeekStartIso,
    endIso: getWeekEndIso(currentWeekStartIso),
  }));

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

  const clearSelection = () => {
    setRange(null);
    setConfirmWeek(null);
    setShowSaveInput(false);
  };

  // Preview the meals planned on the chosen dates.
  const previewQuery = usePlannedMealsBetween(
    range?.startIso ?? "",
    range?.endIso ?? "",
    range !== null
  );
  const preview = useMemo(() => groupMealsByDay(previewQuery.items), [previewQuery.items]);
  const isEmpty = preview.length === 0;
  const canCopy = range !== null && range.startIso !== currentWeekStartIso && !isEmpty;
  const savedNotice = isEmpty ? null : savedLabel;
  const showSelectionDetails =
    showSaveInput || showConfirm || previewQuery.error || savedNotice;
  const rangeIsCurrentWeek =
    range !== null && getWeekStartIso(createDateFromIso(range.startIso)) === currentWeekStartIso;

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
    if (!range) return;
    const saved = await saveAs(name, range.startIso, range.endIso);
    setSavedLabel(`Saved as "${saved.savedName}"`);
    setShowSaveInput(false);
  };

  return (
    <div className="plan-browser__body">
      <DateRangePicker
        startIso={range?.startIso ?? null}
        endIso={range?.endIso ?? null}
        onChange={handleRangeChange}
      />

      {/* The actions sit above the (possibly long) meal list so they never
          scroll out of reach; they enable once a range is chosen. The From/To
          fields already show the chosen dates, so there's no range label. */}
      {range !== null && showSelectionDetails && (
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

      {!showConfirm && (
        <>
          <div className="plan-browser__actions">
            {range !== null && (
              <button type="button" className="btn btn--ghost btn--small" onClick={clearSelection}>
                Clear
              </button>
            )}
            {!rangeIsCurrentWeek && (
              <button
                type="button"
                className="btn btn--ghost btn--small"
                disabled={range === null}
                onClick={() => {
                  if (range) onJumpToWeek(getWeekStartIso(createDateFromIso(range.startIso)));
                }}
              >
                View week ↗
              </button>
            )}
            <button
              type="button"
              className="btn btn--ghost btn--small"
              disabled={range === null || isEmpty || showSaveInput || savedLabel !== null}
              onClick={() => setShowSaveInput(true)}
            >
              Save as Meal Plan…
            </button>
          </div>
          {/* The main action. It reads "Apply" like the Saved plans tab's,
              since both put meals onto the planner starting that day. */}
          <div className="plan-browser__actions">
            <button
              type="button"
              className="btn btn--primary btn--small"
              disabled={!canCopy || copying || copyDone || showSaveInput}
              onClick={() => setConfirmWeek(currentWeekStartIso)}
            >
              {copying
                ? "Applying…"
                : copyDone
                  ? "✓ Applied"
                  : `Apply, starting ${startLabel}`}
            </button>
          </div>
        </>
      )}

      {range !== null && !previewQuery.loading && !isEmpty && (
        <>
          <h3 className="plan-browser__preview-heading">Meals in these dates</h3>
          <MealPreviewDays preview={preview} />
        </>
      )}
    </div>
  );
}
