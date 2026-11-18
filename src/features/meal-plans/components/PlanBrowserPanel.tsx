import { useState } from "react";
import type { CopyMode } from "../types";
import CopyDatesTab from "./CopyDatesTab";
import PlanBrowser, { type PlanBrowserTab } from "./PlanBrowser";
import SavedPlansTab from "./SavedPlansTab";

type Props = {
  currentWeekStartIso: string;
  currentWeekHasItems: boolean;
  onJumpToWeek: (dateIso: string) => void;
  /** Copy the meals planned between two dates to the current week. */
  onCopyRange: (startIso: string, endIso: string, mode: CopyMode) => Promise<void>;
  /** Apply a saved plan to the current week. */
  onApplySavedPlan: (savedPlanId: string, mode: CopyMode) => Promise<void>;
  /** The tab to open on (e.g. Saved plans, when coming back from managing them). */
  initialTab?: PlanBrowserTab;
};

/** The meal planner's Browse plans card. */
export default function PlanBrowserPanel({
  currentWeekStartIso,
  currentWeekHasItems,
  onJumpToWeek,
  onCopyRange,
  onApplySavedPlan,
  initialTab = "calendar",
}: Props) {
  const [activeTab, setActiveTab] = useState<PlanBrowserTab>(initialTab);

  return (
    <PlanBrowser
      activeTab={activeTab}
      onTabChange={setActiveTab}
      calendar={
        <CopyDatesTab
          currentWeekStartIso={currentWeekStartIso}
          currentWeekHasItems={currentWeekHasItems}
          onJumpToWeek={onJumpToWeek}
          onCopyRange={onCopyRange}
        />
      }
      savedPlans={
        <SavedPlansTab
          currentWeekStartIso={currentWeekStartIso}
          currentWeekHasItems={currentWeekHasItems}
          onApplySavedPlan={onApplySavedPlan}
        />
      }
    />
  );
}
