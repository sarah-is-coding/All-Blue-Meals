import { useState } from "react";
import { useLocation } from "react-router-dom";
import { buildGroceryItemsForRange, buildGroceryItemsForSavedPlan } from "../api";
import PlanBrowser, { type PlanBrowserTab } from "../../meal-plans/components/PlanBrowser";
import SavedPlanList from "../../meal-plans/components/SavedPlanList";
import { opensSavedPlansTab } from "../../meal-plans/utils/savedPlansNavigation";
import GroceryCalendarTab from "../components/GroceryCalendarTab";
import GroceryListCard from "../components/GroceryListCard";
import type { GroceryItemDraft, GrocerySource } from "../types";
import { usePlanningPeriod } from "../../../lib/preferences/usePlanningPeriod";
import { formatDateRange, toIsoDate } from "../../../lib/utils/dates";
import type { SavedMealPlan } from "../../meal-plans/types";

type BuiltList = {
  items: GroceryItemDraft[];
  sourceLabel: string;
};

export default function GroceryPage() {
  // ── Source: the open Browse plans tab decides what the list is built from ─
  // The Calendar tab uses the picked dates; the Saved plans tab uses the
  // picked plan (none until one is chosen). Each tab keeps its own choice.
  // Coming back from managing saved plans reopens the Saved plans tab.
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<PlanBrowserTab>(() =>
    opensSavedPlansTab(location.state) ? "saved" : "calendar"
  );
  // Starts on the planning period (the user's cadence) that today is in.
  const period = usePlanningPeriod();
  const [range, setRange] = useState(() => period.around(toIsoDate(new Date())));
  const [selectedPlan, setSelectedPlan] = useState<SavedMealPlan | null>(null);
  const source: GrocerySource | null =
    activeTab === "calendar"
      ? { kind: "range", ...range }
      : selectedPlan
        ? {
            kind: "saved_plan",
            planId: selectedPlan.id,
            planLabel: selectedPlan.savedName,
            startDate: selectedPlan.startDate,
            endDate: selectedPlan.endDate,
          }
        : null;

  // ── The built list ────────────────────────────────────────────────────────
  // Building clears the old list first, so each new list's card starts
  // fresh (no ticks carried over).
  const [built, setBuilt] = useState<BuiltList | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // A list belongs to the source it was built from, so changing the source
  // (dates, plan, or tab) clears it.
  function clearList() {
    setBuilt(null);
    setGenerateError(null);
  }

  const selectRange = (startIso: string, endIso: string) => {
    setRange({ startIso, endIso });
    clearList();
  };

  const handleSelectSavedPlan = (plan: SavedMealPlan) => {
    // Picking the plan that's already picked keeps its list.
    if (plan.id === selectedPlan?.id) return;
    setSelectedPlan(plan);
    clearList();
  };

  const handleTabChange = (tab: PlanBrowserTab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    clearList();
  };

  const handleGenerate = async () => {
    if (source === null) return;
    setGenerating(true);
    clearList();

    try {
      let list: BuiltList;
      if (source.kind === "range") {
        list = {
          items: await buildGroceryItemsForRange(source.startIso, source.endIso),
          sourceLabel: formatDateRange(source.startIso, source.endIso),
        };
      } else {
        list = {
          items: await buildGroceryItemsForSavedPlan(source.planId),
          sourceLabel: source.planLabel,
        };
      }
      setBuilt(list);
    } catch (e) {
      setGenerateError(
        e instanceof Error ? e.message : "Failed to generate grocery list."
      );
    } finally {
      setGenerating(false);
    }
  };

  // Build sits at the end of each tab: under the dates, or under the saved
  // plans list once you've picked one.
  const buildActions = (
    <div className="grocery-route__build-actions">
      <button
        type="button"
        className="btn btn--primary"
        onClick={handleGenerate}
        disabled={generating || source === null}
      >
        {generating ? "Building…" : "Build Grocery List"}
      </button>
      {generateError && (
        <p className="error grocery-route__error">{generateError}</p>
      )}
    </div>
  );

  return (
    <section className="workspace-route grocery-route">
      {/* Header */}
      <article className="workspace-card grocery-route__header">
        <h1>Grocery Lists</h1>
      </article>

      <div className="grocery-layout">
        {/* Browse plans comes first in the page so phones show the picker
            above the (still empty) list; on wide screens it sits on the
            right, where the meal planner has it. */}
        <div className="grocery-sidebar">
          <PlanBrowser
            activeTab={activeTab}
            onTabChange={handleTabChange}
            calendar={
              <GroceryCalendarTab
                startIso={range.startIso}
                endIso={range.endIso}
                onChange={selectRange}
                actions={buildActions}
              />
            }
            savedPlans={
              <SavedPlanList
                selectedPlanId={selectedPlan?.id ?? null}
                onSelectedPlanChange={handleSelectSavedPlan}
                belowList={buildActions}
              />
            }
          />
        </div>

        {built && (
          <div className="grocery-list-area">
            <GroceryListCard items={built.items} sourceLabel={built.sourceLabel} />
          </div>
        )}
      </div>
    </section>
  );
}
