import { useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useDebouncedValue } from "../../../lib/hooks/useDebouncedValue";
import { formatDateRange } from "../../../lib/utils/dates";
import { useSavedMealPlanSearch } from "../queries";
import type { SavedMealPlan } from "../types";
import { manageSavedPlansState } from "../utils/savedPlansNavigation";
import SavedPlanPreview from "./SavedPlanPreview";

type Props = {
  selectedPlanId: string | null;
  onSelectedPlanChange: (plan: SavedMealPlan) => void;
  showPreviewLoading?: boolean;
  /** Shown under the list: the page's action for the picked plan (Apply, Build). */
  belowList?: ReactNode;
};

/**
 * Search saved plans and pick one. Clicking a plan picks it; its arrow opens
 * and closes a preview of its meals. The page puts its action for the picked
 * plan under the list. Beside the search box, a link to manage (rename,
 * delete) saved plans: it acts on the whole list, so it sits at the top with
 * the search rather than near the action. Used by the Saved plans tab on the
 * meal planner and the grocery page.
 */
export default function SavedPlanList({
  selectedPlanId,
  onSelectedPlanChange,
  showPreviewLoading,
  belowList,
}: Props) {
  // Lets the Saved Meal Plans page link back here, with this tab open.
  const { pathname } = useLocation();
  const [searchInput, setSearchInput] = useState("");
  const searchTerm = useDebouncedValue(searchInput, 220);
  const { results, loading, error } = useSavedMealPlanSearch(searchTerm);
  // Show "Loading…" while the user is still typing, not just once the request starts.
  const loadingList = loading || searchInput !== searchTerm;
  // The plan whose preview is open (separate from the picked one).
  const [previewPlanId, setPreviewPlanId] = useState<string | null>(null);

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
        <Link
          to="/app/saved-meal-plans"
          state={manageSavedPlansState(pathname)}
          className="btn btn--ghost"
          aria-label="Manage saved plans"
        >
          Manage
        </Link>
      </div>

      {error && <p className="error">{error}</p>}
      {loadingList && <p className="plan-browser__status">Loading…</p>}

      {!loadingList && results.length === 0 && (
        <p className="plan-browser__status">
          {searchInput.trim() ? "No saved plans match." : "No saved plans yet."}
        </p>
      )}

      {results.length > 0 && (
        <ul className="saved-plan-list">
          {results.map((plan) => {
            const isSelected = plan.id === selectedPlanId;
            const isOpen = plan.id === previewPlanId;
            return (
              <li key={plan.id} className="saved-plan-list__item">
                <div className="saved-plan-list__row">
                  <button
                    type="button"
                    className={`saved-plan-list__btn${isSelected ? " saved-plan-list__btn--active" : ""}`}
                    onClick={() => onSelectedPlanChange(plan)}
                    aria-pressed={isSelected}
                  >
                    <span className="saved-plan-list__name">{plan.savedName}</span>
                    <span className="saved-plan-list__range">
                      {formatDateRange(plan.startDate, plan.endDate)}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="saved-plan-list__toggle"
                    onClick={() => setPreviewPlanId(isOpen ? null : plan.id)}
                    aria-expanded={isOpen}
                    aria-label={`${isOpen ? "Hide" : "Show"} meals in ${plan.savedName}`}
                  >
                    <span aria-hidden="true">{isOpen ? "▲" : "▼"}</span>
                  </button>
                </div>

                {isOpen && (
                  <SavedPlanPreview planId={plan.id} showLoading={showPreviewLoading} />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {belowList}
    </div>
  );
}
