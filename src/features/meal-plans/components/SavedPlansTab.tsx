import { useState } from "react";
import { formatMonthDay } from "../../../lib/utils/dates";
import type { CopyMode, SavedMealPlan } from "../types";
import CopyModeConfirm from "./CopyModeConfirm";
import SavedPlanList from "./SavedPlanList";

type Props = {
  currentWeekStartIso: string;
  currentWeekHasItems: boolean;
  /** Apply a saved plan to the current week. */
  onApplySavedPlan: (savedPlanId: string, mode: CopyMode) => Promise<void>;
};

/**
 * The planner's Saved plans tab: pick a saved plan, then apply it to the
 * week. Works like the grocery page's tab: the action sits under the list.
 */
export default function SavedPlansTab({ currentWeekStartIso, currentWeekHasItems, onApplySavedPlan }: Props) {
  const [selectedPlan, setSelectedPlan] = useState<SavedMealPlan | null>(null);
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
    // Picking the plan that's already picked changes nothing.
    if (plan.id === selectedPlan?.id) return;
    setSelectedPlan(plan);
    setApplyDone(false);
    setShowConfirm(false);
  };

  return (
    <SavedPlanList
      selectedPlanId={selectedPlan?.id ?? null}
      onSelectedPlanChange={handleSelectPlan}
      belowList={
        showConfirm ? (
          <CopyModeConfirm onChoose={executeApply} />
        ) : (
          <div className="plan-browser__main-action">
            <button
              type="button"
              className="btn btn--primary"
              disabled={selectedPlan === null || applying || applyDone}
              onClick={handleApplyClick}
            >
              {applying
                ? "Applying…"
                : applyDone
                  ? "✓ Applied"
                  : `Apply, starting ${formatMonthDay(currentWeekStartIso)}`}
            </button>
            {selectedPlan === null && (
              <p className="plan-browser__status">Pick a saved plan to apply.</p>
            )}
          </div>
        )
      }
    />
  );
}
