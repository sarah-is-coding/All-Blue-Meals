import { useState } from "react";
import { useDebouncedValue } from "../../../lib/hooks/useDebouncedValue";
import PlanSpanCalendar from "../../meal-plans/components/PlanSpanCalendar";
import { useMealPlanSpans, useSavedMealPlanSearch } from "../../meal-plans/queries";
import type { SavedMealPlan } from "../../meal-plans/types";

type PanelTab = "past" | "saved";

type Props = {
  /** Called when user picks a past week from the calendar. weekStartIso is the
   *  plan's start_date (always a Monday). */
  onSelectWeek: (weekStartIso: string) => void;
  /** Called when user picks a named saved plan. */
  onSelectSavedPlan: (plan: SavedMealPlan) => void;
};

// ── Past-weeks tab ────────────────────────────────────────────────────────

function PastWeeksTab({ onSelectWeek }: { onSelectWeek: (iso: string) => void }) {
  const { spans, loading: loadingSpans, error: spansError } = useMealPlanSpans();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const handleSelectPlan = (planId: string | null) => {
    setSelectedPlanId(planId);
    if (!planId) return;
    const span = spans.find((s) => s.id === planId);
    if (span) {
      onSelectWeek(span.startDate);
    }
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
      {!loadingSpans && spans.length > 0 && (
        <p className="past-plan-panel__status">
          Click a highlighted week to load it.
        </p>
      )}
    </div>
  );
}

// ── Saved-plans tab ───────────────────────────────────────────────────────

function SavedPlansTab({
  onSelectSavedPlan,
}: {
  onSelectSavedPlan: (plan: SavedMealPlan) => void;
}) {
  const [searchInput, setSearchInput] = useState("");
  const searchTerm = useDebouncedValue(searchInput, 220);
  const resultsQuery = useSavedMealPlanSearch(searchTerm);
  const results = resultsQuery.results;
  // Show "Loading…" while the user is still typing, not just once the request starts.
  const loadingList = resultsQuery.loading || searchInput !== searchTerm;
  const listError = resultsQuery.error;

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
      {loadingList && (
        <p className="past-plan-panel__status">Loading…</p>
      )}

      {!loadingList && results.length === 0 && (
        <p className="past-plan-panel__status">
          {searchInput.trim()
            ? "No saved plans match."
            : "No saved plans yet."}
        </p>
      )}

      {results.length > 0 && (
        <ul className="saved-plan-list">
          {results.map((plan) => (
            <li key={plan.id} className="saved-plan-list__item">
              <button
                type="button"
                className="saved-plan-list__btn"
                onClick={() => onSelectSavedPlan(plan)}
              >
                <span className="saved-plan-list__name">
                  {plan.savedName}
                </span>
                <span className="saved-plan-list__range">
                  {plan.startDate}
                </span>
                <span
                  className="saved-plan-list__chevron"
                  aria-hidden="true"
                >
                  →
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export default function GroceryPlanBrowser({
  onSelectWeek,
  onSelectSavedPlan,
}: Props) {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<PanelTab>("past");

  const handleSelectWeek = (iso: string) => {
    onSelectWeek(iso);
    // Keep the panel open so the user can see their selection is reflected
    // in the parent and can change their mind without re-opening.
  };

  const handleSelectSavedPlan = (plan: SavedMealPlan) => {
    onSelectSavedPlan(plan);
    // Keep the panel open (same reason as above).
  };

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
              className={`past-plan-panel__tab${
                activeTab === "past" ? " past-plan-panel__tab--active" : ""
              }`}
              onClick={() => setActiveTab("past")}
            >
              Past weeks
            </button>
            <button
              role="tab"
              type="button"
              aria-selected={activeTab === "saved"}
              className={`past-plan-panel__tab${
                activeTab === "saved" ? " past-plan-panel__tab--active" : ""
              }`}
              onClick={() => setActiveTab("saved")}
            >
              Saved plans
            </button>
          </div>

          {activeTab === "past" ? (
            <PastWeeksTab onSelectWeek={handleSelectWeek} />
          ) : (
            <SavedPlansTab onSelectSavedPlan={handleSelectSavedPlan} />
          )}
        </>
      )}
    </article>
  );
}
