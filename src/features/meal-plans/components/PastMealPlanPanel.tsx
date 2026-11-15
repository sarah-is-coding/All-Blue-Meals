import { useEffect, useRef, useState } from "react";
import { useDebouncedValue } from "../../../lib/hooks/useDebouncedValue";
import { formatDateRange, getWeekStartIso } from "../../../lib/utils/dates";
import {
  useMealPlanSpans,
  useSavedMealPlanActions,
  useSavedMealPlanSearch,
  useSavedPlanPreview,
} from "../queries";
import type { SavedMealPlan } from "../types";
import PlanSpanCalendar from "./PlanSpanCalendar";

type CopyMode = "add" | "replace";
type PanelTab = "past" | "saved";

type Props = {
  currentWeekStartIso: string;
  currentWeekHasItems: boolean;
  onJumpToWeek: (weekStartIso: string) => void;
  /** Unified handler for both "copy past week" and "apply saved plan" actions. */
  onApplyPlan: (planId: string, mode: CopyMode) => Promise<void>;
};

// ── Past-weeks tab (calendar-driven) ─────────────────────────────────────

function PastWeeksTab({
  currentWeekStartIso,
  currentWeekHasItems,
  onJumpToWeek,
  onApplyPlan,
}: Props) {
  // Span data for the calendar
  const { spans, loading: loadingSpans, error: spansError } = useMealPlanSpans();

  // Selected plan and its preview
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const {
    preview,
    loading: loadingPreview,
    error: previewError,
  } = useSavedPlanPreview(selectedPlanId);
  const { saveAs } = useSavedMealPlanActions();

  // Copy flow
  const [copying, setCopying] = useState(false);
  const [copyDone, setCopyDone] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Save-as-template flow
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedLabel, setSavedLabel] = useState<string | null>(null);
  const saveInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showSaveInput) saveInputRef.current?.focus();
  }, [showSaveInput]);

  // Reset per-plan UI state when the selection changes.
  const handleSelectPlan = (planId: string | null) => {
    if (planId === selectedPlanId) return;
    setSelectedPlanId(planId);
    if (!planId) return;
    setCopyDone(false);
    setShowConfirm(false);
    setShowSaveInput(false);
    setSavedLabel(null);
  };

  const selectedSpan = spans.find((s) => s.id === selectedPlanId) ?? null;
  const isEmpty = preview.length === 0;
  const isCurrentWeekPlan =
    selectedSpan !== null && selectedSpan.startDate === currentWeekStartIso;

  const executeCopy = (mode: CopyMode) => {
    if (!selectedPlanId) return;
    setShowConfirm(false);
    setCopying(true);
    setCopyDone(false);
    onApplyPlan(selectedPlanId, mode)
      .then(() => setCopyDone(true))
      .catch(() => { /* parent surfaces the error */ })
      .finally(() => setCopying(false));
  };

  const handleCopyClick = () => {
    if (!selectedPlanId || isEmpty) return;
    if (currentWeekHasItems) {
      setShowConfirm(true);
    } else {
      executeCopy("add");
    }
  };

  const handleSaveSubmit = () => {
    if (!selectedPlanId || !saveName.trim()) return;
    setSaving(true);
    setSaveError(null);
    saveAs(selectedPlanId, saveName.trim())
      .then((saved) => {
        setSavedLabel(`Saved as "${saved.savedName}"`);
        setShowSaveInput(false);
        setSaveName("");
      })
      .catch((e) => setSaveError(e instanceof Error ? e.message : "Failed to save plan."))
      .finally(() => setSaving(false));
  };

  return (
    <div className="past-plan-panel__body">
      {spansError && <p className="error">{spansError}</p>}

      <PlanSpanCalendar
        spans={spans}
        selectedPlanId={selectedPlanId}
        onSelectPlan={handleSelectPlan}
        isLoading={loadingSpans}
      />

      {selectedSpan && (
        <div className="past-plan-panel__selection">
          <p className="past-plan-panel__week-label">
            {formatDateRange(selectedSpan.startDate, selectedSpan.endDate)}
            {isCurrentWeekPlan && (
              <span className="past-plan-panel__current-badge">current</span>
            )}
          </p>

          {previewError && <p className="error">{previewError}</p>}
          {loadingPreview && <p className="past-plan-panel__status">Loading preview…</p>}

          {!loadingPreview && isEmpty && !previewError && (
            <p className="past-plan-panel__status">No meals in this plan.</p>
          )}

          {!loadingPreview && !isEmpty && (
            <div className="past-plan-panel__preview">
              {preview.map(({ dateIso, recipes }) => {
                const [y, m, d] = dateIso.split("-").map(Number);
                const dayLabel = new Intl.DateTimeFormat("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                }).format(new Date(y, m - 1, d));
                return (
                  <div key={dateIso} className="past-plan-panel__day">
                    <span className="past-plan-panel__day-label">{dayLabel}</span>
                    {recipes.length === 0 ? (
                      <span className="past-plan-panel__day-empty">—</span>
                    ) : (
                      <span className="past-plan-panel__day-recipes">
                        {recipes.join(" · ")}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Save-as-template */}
          {!isEmpty && !showSaveInput && !savedLabel && (
            <button
              type="button"
              className="btn btn--ghost past-plan-panel__save-btn"
              onClick={() => setShowSaveInput(true)}
            >
              Save as Meal Plan…
            </button>
          )}
          {!isEmpty && savedLabel && (
            <p className="past-plan-panel__save-done">✓ {savedLabel}</p>
          )}
          {showSaveInput && (
            <div className="past-plan-panel__save-form">
              <input
                ref={saveInputRef}
                type="text"
                className="past-plan-panel__save-input"
                placeholder="Meal plan name"
                value={saveName}
                maxLength={80}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveSubmit();
                  if (e.key === "Escape") { setShowSaveInput(false); setSaveName(""); }
                }}
              />
              <div className="past-plan-panel__actions">
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

          {/* Copy-to-current-week */}
          {showConfirm ? (
            <div className="past-plan-panel__confirm">
              <p className="past-plan-panel__confirm-label">
                Current week already has meals. What would you like to do?
              </p>
              <div className="past-plan-panel__actions">
                <button type="button" className="btn btn--ghost" onClick={() => executeCopy("add")}>
                  Add on top
                </button>
                <button type="button" className="btn btn--primary" onClick={() => executeCopy("replace")}>
                  Replace existing
                </button>
              </div>
            </div>
          ) : (
            <div className="past-plan-panel__actions">
              {!isCurrentWeekPlan && (
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => {
                    const [y, m, d] = selectedSpan.startDate.split("-").map(Number);
                    onJumpToWeek(getWeekStartIso(new Date(y, m - 1, d)));
                  }}
                >
                  View week ↗
                </button>
              )}
              {!isEmpty && (
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={copying || copyDone}
                  onClick={handleCopyClick}
                >
                  {copying ? "Copying…" : copyDone ? "✓ Copied" : "Copy to current week"}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Saved-plans tab ───────────────────────────────────────────────────────

function SavedPlansTab({
  currentWeekHasItems,
  onApplyPlan,
}: {
  currentWeekHasItems: boolean;
  onApplyPlan: (planId: string, mode: CopyMode) => Promise<void>;
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
    onApplyPlan(selectedPlan.id, mode)
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

  const previewDays = preview.map((p) => p.dateIso).sort();
  const previewByDate = new Map(preview.map((p) => [p.dateIso, p.recipes]));

  return (
    <div className="past-plan-panel__body">
      <div className="past-plan-panel__search-row">
        <input
          type="search"
          className="past-plan-panel__search-input"
          placeholder="Search saved plans…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      {listError && <p className="error">{listError}</p>}
      {loadingList && <p className="past-plan-panel__status">Loading…</p>}

      {!loadingList && results.length === 0 && (
        <p className="past-plan-panel__status">
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
                    {plan.startDate}
                  </span>
                  <span className="saved-plan-list__chevron" aria-hidden="true">
                    {isSelected ? "▲" : "▼"}
                  </span>
                </button>

                {isSelected && (
                  <div className="saved-plan-list__detail">
                    {previewError && <p className="error">{previewError}</p>}
                    {loadingPreview && <p className="past-plan-panel__status">Loading preview…</p>}
                    {!loadingPreview && preview.length === 0 && !previewError && (
                      <p className="past-plan-panel__status">No meals in this plan.</p>
                    )}
                    {!loadingPreview && preview.length > 0 && (
                      <div className="past-plan-panel__preview past-plan-panel__preview--compact">
                        {previewDays.map((dateIso) => {
                          const recipes = previewByDate.get(dateIso) ?? [];
                          const [y, m, d] = dateIso.split("-").map(Number);
                          const dayLabel = new Intl.DateTimeFormat("en-US", {
                            weekday: "short", month: "short", day: "numeric",
                          }).format(new Date(y, m - 1, d));
                          return (
                            <div key={dateIso} className="past-plan-panel__day">
                              <span className="past-plan-panel__day-label">{dayLabel}</span>
                              {recipes.length === 0 ? (
                                <span className="past-plan-panel__day-empty">—</span>
                              ) : (
                                <span className="past-plan-panel__day-recipes">
                                  {recipes.join(" · ")}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {showConfirm ? (
                      <div className="past-plan-panel__confirm">
                        <p className="past-plan-panel__confirm-label">
                          Current week already has meals. What would you like to do?
                        </p>
                        <div className="past-plan-panel__actions">
                          <button type="button" className="btn btn--ghost" onClick={() => executeApply("add")}>
                            Add on top
                          </button>
                          <button type="button" className="btn btn--primary" onClick={() => executeApply("replace")}>
                            Replace existing
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="past-plan-panel__actions">
                        <button
                          type="button"
                          className="btn btn--primary"
                          disabled={applying || applyDone}
                          onClick={handleApplyClick}
                        >
                          {applying ? "Applying…" : applyDone ? "✓ Applied" : "Apply to current week"}
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

export default function PastMealPlanPanel({
  currentWeekStartIso,
  currentWeekHasItems,
  onJumpToWeek,
  onApplyPlan,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<PanelTab>("past");

  return (
    <article className="workspace-card past-plan-panel">
      <button
        type="button"
        className="past-plan-panel__toggle"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
      >
        <span className="past-plan-panel__toggle-label">Browse plans</span>
        <span className="past-plan-panel__chevron" aria-hidden="true">
          {isOpen ? "▲" : "▼"}
        </span>
      </button>

      {isOpen && (
        <>
          <div className="past-plan-panel__tabs" role="tablist">
            <button
              role="tab"
              type="button"
              aria-selected={activeTab === "past"}
              className={`past-plan-panel__tab${activeTab === "past" ? " past-plan-panel__tab--active" : ""}`}
              onClick={() => setActiveTab("past")}
            >
              Past weeks
            </button>
            <button
              role="tab"
              type="button"
              aria-selected={activeTab === "saved"}
              className={`past-plan-panel__tab${activeTab === "saved" ? " past-plan-panel__tab--active" : ""}`}
              onClick={() => setActiveTab("saved")}
            >
              Saved plans
            </button>
          </div>

          {activeTab === "past" ? (
            <PastWeeksTab
              currentWeekStartIso={currentWeekStartIso}
              currentWeekHasItems={currentWeekHasItems}
              onJumpToWeek={onJumpToWeek}
              onApplyPlan={onApplyPlan}
            />
          ) : (
            <SavedPlansTab
              currentWeekHasItems={currentWeekHasItems}
              onApplyPlan={onApplyPlan}
            />
          )}
        </>
      )}
    </article>
  );
}
