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
  const [confirmWeek, setConfirmWeek] = useState<string | null>(null);
  const showConfirm = confirmWeek === currentWeekStartIso;
  if (confirmWeek !== null && !showConfirm) setConfirmWeek(null);
  const startLabel = formatMonthDay(currentWeekStartIso);

  const executeApply = (mode: CopyMode) => {
    if (!showConfirm || !selectedPlan) return;
    setConfirmWeek(null);
    setApplying(true);
    setApplyDone(false);
    onApplySavedPlan(selectedPlan.id, mode)
      .then(() => setApplyDone(true))
      .catch(() => { /* parent surfaces error */ })
      .finally(() => setApplying(false));
  };

  const handleSelectPlan = (plan: SavedMealPlan) => {
    // Picking the plan that's already picked changes nothing.
    if (plan.id === selectedPlan?.id) return;
    setSelectedPlan(plan);
    setApplyDone(false);
    setConfirmWeek(null);
  };

  return (
    <SavedPlanList
      selectedPlanId={selectedPlan?.id ?? null}
      onSelectedPlanChange={handleSelectPlan}
      showPreviewLoading={false}
      belowList={
        showConfirm ? (
          <CopyModeConfirm
            startLabel={startLabel}
            hasMeals={currentWeekHasItems}
            onChoose={executeApply}
            onCancel={() => setConfirmWeek(null)}
          />
        ) : (
          <div className="plan-browser__actions">
            <button
              type="button"
              className="btn btn--primary btn--small"
              disabled={selectedPlan === null || applying || applyDone}
              onClick={() => setConfirmWeek(currentWeekStartIso)}
            >
              {applying
                ? "Applying…"
                : applyDone
                  ? "✓ Applied"
                  : `Apply from ${startLabel}`}
            </button>
          </div>
        )
      }
    />
  );
}
