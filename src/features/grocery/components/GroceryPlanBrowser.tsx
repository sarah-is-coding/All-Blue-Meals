import { useState } from "react";
import { useDebouncedValue } from "../../../lib/hooks/useDebouncedValue";
import { formatDateRange } from "../../../lib/utils/dates";
import { useSavedMealPlanSearch } from "../../meal-plans/queries";
import type { SavedMealPlan } from "../../meal-plans/types";

// Lets the grocery page build a list from a saved plan instead of the dates
// on the calendar. (Past weeks used to be listed here too; the date range on
// the grocery page replaces that.)

type Props = {
  /** Called when user picks a named saved plan. */
  onSelectSavedPlan: (plan: SavedMealPlan) => void;
};

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
      {loadingList && (
        <p className="plan-browser__status">Loading…</p>
      )}

      {!loadingList && results.length === 0 && (
        <p className="plan-browser__status">
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
                  {formatDateRange(plan.startDate, plan.endDate)}
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

export default function GroceryPlanBrowser({ onSelectSavedPlan }: Props) {
  // Closed by default: building from dates is the usual path.
  const [isOpen, setIsOpen] = useState(false);

  return (
    <article className="workspace-card plan-browser">
      <button
        type="button"
        className="plan-browser__toggle"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
      >
        <span className="plan-browser__toggle-label">Or use a saved plan</span>
        <span className="plan-browser__chevron" aria-hidden="true">
          {isOpen ? "▲" : "▼"}
        </span>
      </button>

      {/* Keep the panel open after choosing, so the user can change their mind. */}
      {isOpen && <SavedPlansTab onSelectSavedPlan={onSelectSavedPlan} />}
    </article>
  );
}
