import { useEffect, useMemo, useRef, useState } from "react";
import { useDebouncedValue } from "../../../lib/hooks/useDebouncedValue";
import { createDateFromIso, formatDateRange, getWeekStartIso } from "../../../lib/utils/dates";
import {
  usePlannedMealsBetween,
  useSavedMealPlanActions,
  useSavedMealPlanSearch,
  useSavedPlanPreview,
} from "../queries";
import type { MealPlanDayPreview, SavedMealPlan } from "../types";
import { groupMealsByDay } from "../utils/groupMealsByDay";
import DateRangePicker from "./DateRangePicker";

type CopyMode = "add" | "replace";
type PanelTab = "copy" | "saved";

type Props = {
  currentWeekStartIso: string;
  currentWeekHasItems: boolean;
  onJumpToWeek: (weekStartIso: string) => void;
  /** Copy the meals planned between two dates to the current week. */
  onCopyRange: (startIso: string, endIso: string, mode: CopyMode) => Promise<void>;
  /** Apply a saved plan to the current week. */
  onApplySavedPlan: (savedPlanId: string, mode: CopyMode) => Promise<void>;
};

type DateRange = { startIso: string; endIso: string };

const dayLabelFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

/** "May 25": where copied or applied meals start (ranges can be any length). */
const startDayFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

function startDayLabel(weekStartIso: string): string {
  return startDayFmt.format(createDateFromIso(weekStartIso));
}

function dayLabel(dateIso: string): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  return dayLabelFmt.format(new Date(y, m - 1, d));
}

function PreviewDays({ preview, compact }: { preview: MealPlanDayPreview[]; compact?: boolean }) {
  return (
    <div className={`plan-browser__preview${compact ? " plan-browser__preview--compact" : ""}`}>
      {preview.map(({ dateIso, recipes }) => (
        <div key={dateIso} className="plan-browser__day">
          <span className="plan-browser__day-label">{dayLabel(dateIso)}</span>
          {recipes.length === 0 ? (
            <span className="plan-browser__day-empty">—</span>
          ) : (
            <span className="plan-browser__day-recipes">{recipes.join(" · ")}</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Copy-a-date-range tab ────────────────────────────────────────────────

function CopyDatesTab({
  currentWeekStartIso,
  currentWeekHasItems,
  onJumpToWeek,
  onCopyRange,
}: Omit<Props, "onApplySavedPlan">) {
  // The picker owns how a range is chosen (taps or typing); the tab owns
  // what's done with it. Nothing is previewed until a range is picked.
  const [range, setRange] = useState<DateRange | null>(null);

  // Copy flow
  const [copying, setCopying] = useState(false);
  const [copyDone, setCopyDone] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Save-as-plan flow
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedLabel, setSavedLabel] = useState<string | null>(null);
  const saveInputRef = useRef<HTMLInputElement>(null);
  const { saveAs } = useSavedMealPlanActions();

  useEffect(() => {
    if (showSaveInput) saveInputRef.current?.focus();
  }, [showSaveInput]);

  const handleRangeChange = (startIso: string, endIso: string) => {
    setRange({ startIso, endIso });
    // A new selection starts the flows over.
    setCopyDone(false);
    setShowConfirm(false);
    setShowSaveInput(false);
    setSaveError(null);
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

  const handleSaveSubmit = () => {
    if (!range || !saveName.trim()) return;
    setSaving(true);
    setSaveError(null);
    saveAs(saveName.trim(), range.startIso, range.endIso)
      .then((saved) => {
        setSavedLabel(`Saved as "${saved.savedName}"`);
        setShowSaveInput(false);
        setSaveName("");
      })
      .catch((e) => setSaveError(e instanceof Error ? e.message : "Failed to save plan."))
      .finally(() => setSaving(false));
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
            <div className="plan-browser__save-form">
              <input
                ref={saveInputRef}
                type="text"
                className="plan-browser__save-input"
                placeholder="Meal plan name"
                value={saveName}
                maxLength={80}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveSubmit();
                  if (e.key === "Escape") { setShowSaveInput(false); setSaveName(""); }
                }}
              />
              <div className="plan-browser__actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => { setShowSaveInput(false); setSaveName(""); }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={saving || !saveName.trim()}
                  onClick={handleSaveSubmit}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
              {saveError && <p className="error">{saveError}</p>}
            </div>
          )}

          {showConfirm && (
            <div className="plan-browser__confirm">
              <p className="plan-browser__confirm-label">
                The week you're viewing already has meals. What would you like to do?
              </p>
              <div className="plan-browser__actions">
                <button type="button" className="btn btn--ghost" onClick={() => executeCopy("add")}>
                  Add on top
                </button>
                <button type="button" className="btn btn--primary" onClick={() => executeCopy("replace")}>
                  Replace existing
                </button>
              </div>
            </div>
          )}

          {previewQuery.error && <p className="error">{previewQuery.error}</p>}
          {loadingPreview && <p className="plan-browser__status">Loading preview…</p>}

          {!loadingPreview && isEmpty && !previewQuery.error && (
            <p className="plan-browser__status">No meals planned on these dates.</p>
          )}
        </div>
      )}

      {!showConfirm && (
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
          <button
            type="button"
            className="btn btn--primary"
            disabled={range === null || isEmpty || copying || copyDone}
            onClick={handleCopyClick}
          >
            {copying
              ? "Copying…"
              : copyDone
                ? "✓ Copied"
                : `Copy, starting ${startDayLabel(currentWeekStartIso)}`}
          </button>
        </div>
      )}

      {range !== null && !loadingPreview && !isEmpty && (
        <>
          <h3 className="plan-browser__preview-heading">Meals in these dates</h3>
          <PreviewDays preview={preview} />
        </>
      )}
    </div>
  );
}

// ── Saved-plans tab ───────────────────────────────────────────────────────

function SavedPlansTab({
  currentWeekStartIso,
  currentWeekHasItems,
  onApplySavedPlan,
}: {
  currentWeekStartIso: string;
  currentWeekHasItems: boolean;
  onApplySavedPlan: (savedPlanId: string, mode: CopyMode) => Promise<void>;
}) {
  const [searchInput, setSearchInput] = useState("");
  const searchTerm = useDebouncedValue(searchInput, 220);
  const searchQuery = useSavedMealPlanSearch(searchTerm);
  const results = searchQuery.results;
  // Show "Loading…" while the user is still typing, not just once the request starts.
  const loadingList = searchQuery.loading || searchInput !== searchTerm;
  const listError = searchQuery.error;

  const [selectedPlan, setSelectedPlan] = useState<SavedMealPlan | null>(null);
  const {
    preview,
    loading: loadingPreview,
    error: previewError,
  } = useSavedPlanPreview(selectedPlan?.id ?? null);

  const [applying, setApplying] = useState(false);
  const [applyDone, setApplyDone] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const executeApply = (mode: CopyMode) => {
    if (!selectedPlan) return;
    setShowConfirm(false);
    setApplying(true);
    setApplyDone(false);
    onApplySavedPlan(selectedPlan.id, mode)
      .then(() => setApplyDone(true))
      .catch(() => { /* parent surfaces error */ })
      .finally(() => setApplying(false));
  };

  const handleApplyClick = () => {
    if (!selectedPlan) return;
    if (currentWeekHasItems) {
      setShowConfirm(true);
    } else {
      executeApply("add");
    }
  };

  const handleSelectPlan = (plan: SavedMealPlan) => {
    setSelectedPlan((prev) => (prev?.id === plan.id ? null : plan));
    setApplyDone(false);
    setShowConfirm(false);
  };

  return (
    <div className="plan-browser__body">
      <div className="plan-browser__search-row">
        <input
          type="search"
          className="plan-browser__search-input"
          placeholder="Search saved plans…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      {listError && <p className="error">{listError}</p>}
      {loadingList && <p className="plan-browser__status">Loading…</p>}

      {!loadingList && results.length === 0 && (
        <p className="plan-browser__status">
          {searchInput.trim() ? "No saved plans match." : "No saved plans yet."}
        </p>
      )}

      {results.length > 0 && (
        <ul className="saved-plan-list">
          {results.map((plan) => {
            const isSelected = selectedPlan?.id === plan.id;
            return (
              <li key={plan.id} className="saved-plan-list__item">
                <button
                  type="button"
                  className={`saved-plan-list__btn${isSelected ? " saved-plan-list__btn--active" : ""}`}
                  onClick={() => handleSelectPlan(plan)}
                  aria-expanded={isSelected}
                >
                  <span className="saved-plan-list__name">{plan.savedName}</span>
                  <span className="saved-plan-list__range">
                    {formatDateRange(plan.startDate, plan.endDate)}
                  </span>
                  <span className="saved-plan-list__chevron" aria-hidden="true">
                    {isSelected ? "▲" : "▼"}
                  </span>
                </button>

                {isSelected && (
                  <div className="saved-plan-list__detail">
                    {previewError && <p className="error">{previewError}</p>}
                    {loadingPreview && <p className="plan-browser__status">Loading preview…</p>}
                    {!loadingPreview && preview.length === 0 && !previewError && (
                      <p className="plan-browser__status">No meals in this plan.</p>
                    )}
                    {!loadingPreview && preview.length > 0 && (
                      <PreviewDays preview={preview} compact />
                    )}

                    {showConfirm ? (
                      <div className="plan-browser__confirm">
                        <p className="plan-browser__confirm-label">
                          The week you're viewing already has meals. What would you like to do?
                        </p>
                        <div className="plan-browser__actions">
                          <button type="button" className="btn btn--ghost" onClick={() => executeApply("add")}>
                            Add on top
                          </button>
                          <button type="button" className="btn btn--primary" onClick={() => executeApply("replace")}>
                            Replace existing
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="plan-browser__actions">
                        <button
                          type="button"
                          className="btn btn--primary"
                          disabled={applying || applyDone}
                          onClick={handleApplyClick}
                        >
                          {applying
                            ? "Applying…"
                            : applyDone
                              ? "✓ Applied"
                              : `Apply, starting ${startDayLabel(currentWeekStartIso)}`}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────

export default function PlanBrowserPanel({
  currentWeekStartIso,
  currentWeekHasItems,
  onJumpToWeek,
  onCopyRange,
  onApplySavedPlan,
}: Props) {
  const [activeTab, setActiveTab] = useState<PanelTab>("copy");

  return (
    <article className="workspace-card plan-browser">
      <h2 className="plan-browser__heading">Browse plans</h2>

      <>
          <div className="plan-browser__tabs" role="tablist">
            <button
              role="tab"
              type="button"
              aria-selected={activeTab === "copy"}
              className={`plan-browser__tab${activeTab === "copy" ? " plan-browser__tab--active" : ""}`}
              onClick={() => setActiveTab("copy")}
            >
              Calendar
            </button>
            <button
              role="tab"
              type="button"
              aria-selected={activeTab === "saved"}
              className={`plan-browser__tab${activeTab === "saved" ? " plan-browser__tab--active" : ""}`}
              onClick={() => setActiveTab("saved")}
            >
              Saved plans
            </button>
          </div>

          {activeTab === "copy" ? (
            <CopyDatesTab
              currentWeekStartIso={currentWeekStartIso}
              currentWeekHasItems={currentWeekHasItems}
              onJumpToWeek={onJumpToWeek}
              onCopyRange={onCopyRange}
            />
          ) : (
            <SavedPlansTab
              currentWeekStartIso={currentWeekStartIso}
              currentWeekHasItems={currentWeekHasItems}
              onApplySavedPlan={onApplySavedPlan}
            />
          )}
      </>
    </article>
  );
}
