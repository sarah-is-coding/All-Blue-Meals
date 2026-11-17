import { screen, fireEvent, render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import PlanBrowser, { type PlanBrowserTab } from "../../../../features/meal-plans/components/PlanBrowser";

function renderBrowser(activeTab: PlanBrowserTab) {
  const onTabChange = vi.fn();
  render(
    <PlanBrowser
      activeTab={activeTab}
      onTabChange={onTabChange}
      calendar={<p>Calendar content</p>}
      savedPlans={<p>Saved plans content</p>}
    />
  );
  return { onTabChange };
}

// The shared "Browse plans" card used by the meal planner and the grocery page.
describe("PlanBrowser", () => {
  it("shows its heading and both tabs", () => {
    renderBrowser("calendar");
    expect(screen.getByRole("heading", { name: "Browse plans" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Calendar" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Saved plans" })).toBeInTheDocument();
  });

  it("shows only the open tab's content and marks that tab selected", () => {
    renderBrowser("saved");
    expect(screen.getByText("Saved plans content")).toBeInTheDocument();
    expect(screen.queryByText("Calendar content")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Saved plans" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Calendar" })).toHaveAttribute("aria-selected", "false");
  });

  it("reports tab clicks to the page, which owns the open tab", () => {
    const { onTabChange } = renderBrowser("calendar");
    fireEvent.click(screen.getByRole("tab", { name: "Saved plans" }));
    expect(onTabChange).toHaveBeenCalledWith("saved");
  });
});
