import type { ReactNode } from "react";

// The "Browse plans" card: a Calendar tab and a Saved plans tab, shared by
// the meal planner and the grocery page so both look and behave the same.
// Each page supplies what the tabs contain.

export type PlanBrowserTab = "calendar" | "saved";

type Props = {
  activeTab: PlanBrowserTab;
  onTabChange: (tab: PlanBrowserTab) => void;
  calendar: ReactNode;
  savedPlans: ReactNode;
};

const TABS: Array<{ id: PlanBrowserTab; label: string }> = [
  { id: "calendar", label: "Calendar" },
  { id: "saved", label: "Saved plans" },
];

export default function PlanBrowser({ activeTab, onTabChange, calendar, savedPlans }: Props) {
  return (
    <article className="workspace-card plan-browser">
      <h2 className="plan-browser__heading">Browse plans</h2>

      <div className="plan-browser__tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={activeTab === tab.id}
            className={`plan-browser__tab${activeTab === tab.id ? " plan-browser__tab--active" : ""}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "calendar" ? calendar : savedPlans}
    </article>
  );
}
