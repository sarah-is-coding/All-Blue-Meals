import { useMemo, useState } from "react";
import SaveNameForm from "../../../components/forms/SaveNameForm";
import { createDateFromIso, formatMonthDay, getWeekStartIso } from "../../../lib/utils/dates";
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
  // The picker owns how a range is chosen (taps or typing); the tab owns
  // what's done with it. Nothing is previewed until a range is picked.
  const [range, setRange] = useState<DateRange | null>(null);

  // Copy flow
  const [copying, setCopying] = useState(false);
  const [copyDone, setCopyDone] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Save-as-plan flow
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [savedLabel, setSavedLabel] = useState<string | null>(null);
  const { saveAs } = useSavedMealPlanActions();

  const handleRangeChange = (startIso: string, endIso: string) => {
    setRange({ startIso, endIso });
    // A new selection starts the flows over.
    setCopyDone(false);
    setShowConfirm(false);
    setShowSaveInput(false);
    setSavedLabel(null);
  };

  const clearSelection = () => {
    setRange(null);
    setShowConfirm(false);
    setShowSaveInput(false);
  };

  // Preview the meals planned on the chosen dates.
  const previewQuery = usePlannedMealsBetween(
    range?.startIso ?? "",
    range?.endIso ?? "",
    range !== null
  );
  const preview = useMemo(() => groupMealsByDay(previewQuery.items), [previewQuery.items]);
  const loadingPreview = range !== null && previewQuery.loading;
  const isEmpty = preview.length === 0;
  const rangeIsCurrentWeek =
    range !== null && getWeekStartIso(createDateFromIso(range.startIso)) === currentWeekStartIso;

  const executeCopy = (mode: CopyMode) => {
    if (!range) return;
    setShowConfirm(false);
    setCopying(true);
    setCopyDone(false);
    onCopyRange(range.startIso, range.endIso, mode)
      .then(() => setCopyDone(true))
      .catch(() => { /* parent surfaces the error */ })
      .finally(() => setCopying(false));
  };

  const handleCopyClick = () => {
    if (!range || isEmpty) return;
    if (currentWeekHasItems) {
      setShowConfirm(true);
    } else {
      executeCopy("add");
    }
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
      {range !== null && (
        <div className="plan-browser__selection">
          {!isEmpty && savedLabel && (
            <p className="plan-browser__save-done">✓ {savedLabel}</p>
          )}
          {showSaveInput && (
            <SaveNameForm
              placeholder="Meal plan name"
              onSave={handleSave}
              onCancel={() => setShowSaveInput(false)}
              errorFallback="Failed to save plan."
            />
          )}

          {showConfirm && <CopyModeConfirm onChoose={executeCopy} />}

          {previewQuery.error && <p className="error">{previewQuery.error}</p>}
          {loadingPreview && <p className="plan-browser__status">Loading preview…</p>}

          {!loadingPreview && isEmpty && !previewQuery.error && (
            <p className="plan-browser__status">No meals planned on these dates.</p>
          )}
        </div>
      )}

      {!showConfirm && (
        <>
          <div className="plan-browser__actions">
            {range !== null && (
              <button type="button" className="btn btn--ghost" onClick={clearSelection}>
                Clear
              </button>
            )}
            {!rangeIsCurrentWeek && (
              <button
                type="button"
                className="btn btn--ghost"
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
              className="btn btn--ghost"
              disabled={range === null || isEmpty || showSaveInput || savedLabel !== null}
              onClick={() => setShowSaveInput(true)}
            >
              Save as Meal Plan…
            </button>
          </div>
          {/* The main action. It reads "Apply" like the Saved plans tab's,
              since both put meals onto the planner starting that day. */}
          <div className="plan-browser__main-action">
            <button
              type="button"
              className="btn btn--primary"
              disabled={range === null || isEmpty || copying || copyDone}
              onClick={handleCopyClick}
            >
              {copying
                ? "Applying…"
                : copyDone
                  ? "✓ Applied"
                  : `Apply, starting ${formatMonthDay(currentWeekStartIso)}`}
            </button>
            {range === null && <p className="plan-browser__status">Pick dates to apply.</p>}
          </div>
        </>
      )}

      {range !== null && !loadingPreview && !isEmpty && (
        <>
          <h3 className="plan-browser__preview-heading">Meals in these dates</h3>
          <MealPreviewDays preview={preview} />
        </>
      )}
    </div>
  );
}
