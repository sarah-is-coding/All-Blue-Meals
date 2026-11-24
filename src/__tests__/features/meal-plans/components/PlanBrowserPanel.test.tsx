import { screen, fireEvent, waitFor, within } from "@testing-library/react";
import { renderWithProviders } from "../../../utils/renderWithProviders";
import type { UserPreferences } from "../../../../lib/preferences/types";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import PlanBrowserPanel from "../../../../features/meal-plans/components/PlanBrowserPanel";
import type { PlannedMeal } from "../../../../features/meal-plans/types";

// ── Mock the API module ──────────────────────────────────────
vi.mock("../../../../features/meal-plans/api", () => ({
  listPlannedMealsBetween: vi.fn(),
  previewSavedMealPlan: vi.fn(),
  saveMealsAsPlan: vi.fn(),
  searchSavedMealPlans: vi.fn(),
}));

// Mock MealDatesCalendar so tests pick days without simulating the month
// grid; the calendar's own behavior is covered in MealDatesCalendar.test.tsx.
vi.mock("../../../../features/meal-plans/components/MealDatesCalendar", () => ({
  default: ({
    onSelectDay,
    rangeStartIso,
    rangeEndIso,
  }: {
    rangeStartIso: string | null;
    rangeEndIso: string | null;
    onSelectDay: (dateIso: string) => void;
  }) => (
    <div data-testid="meal-dates-calendar" data-range={`${rangeStartIso}..${rangeEndIso}`}>
      {["2026-05-18", "2026-05-20", "2026-05-24"].map((iso) => (
        <button key={iso} type="button" onClick={() => onSelectDay(iso)}>
          Day {iso}
        </button>
      ))}
    </div>
  ),
}));

import {
  listPlannedMealsBetween,
  previewSavedMealPlan,
  saveMealsAsPlan,
  searchSavedMealPlans,
} from "../../../../features/meal-plans/api";

const CURRENT_WEEK = "2026-05-31";

/** A planned meal on the picked dates (the copy tab's preview source). */
const pastaMeal: PlannedMeal = {
  id: "i1",
  recipeId: "recipe-1",
  recipeTitle: "Pasta",
  plannedFor: "2026-05-18",
  mealType: "dinner",
  servingsOverride: null,
  recipeServings: 4,
  effectiveServings: 4,
};

function renderPanel(
  overrides: {
    currentWeekHasItems?: boolean;
    onCopyRange?: () => Promise<void>;
    onApplySavedPlan?: () => Promise<void>;
    preferences?: Partial<UserPreferences>;
  } = {}
) {
  const onJumpToWeek = vi.fn();
  const onCopyRange = overrides.onCopyRange ?? vi.fn().mockResolvedValue(undefined);
  const onApplySavedPlan = overrides.onApplySavedPlan ?? vi.fn().mockResolvedValue(undefined);

  renderWithProviders(
    <MemoryRouter>
      <PlanBrowserPanel
        currentWeekStartIso={CURRENT_WEEK}
        currentWeekHasItems={overrides.currentWeekHasItems ?? false}
        onJumpToWeek={onJumpToWeek}
        onCopyRange={onCopyRange}
        onApplySavedPlan={onApplySavedPlan}
      />
    </MemoryRouter>,
    { preferences: overrides.preferences }
  );
  return { onJumpToWeek, onCopyRange, onApplySavedPlan };
}

const pickDay = (iso: string) =>
  fireEvent.click(screen.getByRole("button", { name: `Day ${iso}` }));

// The panel used to collapse behind a toggle; it's now always open so the
// calendar and actions are discoverable without a click.
describe("PlanBrowserPanel — always open", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listPlannedMealsBetween).mockResolvedValue([]);
  });

  it("shows its heading and both tabs with no clicks", () => {
    renderPanel();
    expect(screen.getByRole("heading", { name: /browse plans/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^calendar$/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /saved plans/i })).toBeInTheDocument();
  });

  it("preselects the viewed week and keeps actions compact", () => {
    renderPanel();
    expect(screen.getByLabelText("From")).toHaveValue(CURRENT_WEEK);
    expect(screen.getByLabelText("To")).toHaveValue("2026-06-06");
    expect(screen.getByTestId("meal-dates-calendar")).toHaveAttribute("data-range", "2026-05-31..2026-06-06");
    expect(screen.queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();
    const actions = within(screen.getByRole("group", { name: "Meal plan actions" }));
    expect(actions.getAllByRole("button")).toEqual([
      actions.getByRole("button", { name: "Apply from May 31" }),
      actions.getByRole("button", { name: "Save plan" }),
    ]);
    expect(screen.queryByRole("button", { name: /view week/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Pick dates to apply.")).not.toBeInTheDocument();
  });

  it("preselects the user's planning period: 2 weeks from the viewed week", () => {
    renderPanel({ preferences: { planningCadence: { unit: "week", count: 2 } } });
    expect(screen.getByTestId("meal-dates-calendar")).toHaveAttribute("data-range", "2026-05-31..2026-06-13");
  });

  // A month from the viewed week, not the calendar month it's in (May 1–31
  // used to be preselected, which showed "View week" and let the default dates
  // be copied onto themselves).
  it("preselects the user's planning period: a month from the viewed week", () => {
    renderPanel({ preferences: { planningCadence: { unit: "month", count: 1 } } });
    expect(screen.getByTestId("meal-dates-calendar")).toHaveAttribute("data-range", "2026-05-31..2026-06-30");
    expect(screen.queryByRole("button", { name: /view week/i })).not.toBeInTheDocument();
  });
});

describe("PlanBrowserPanel — Calendar tab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listPlannedMealsBetween).mockResolvedValue([]);
  });

  it("is the default active tab, showing the calendar", () => {
    renderPanel();
    expect(screen.getByRole("tab", { name: /^calendar$/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("meal-dates-calendar")).toBeInTheDocument();
  });

  it("can save the preselected meals and prevents applying them to the same dates", async () => {
    vi.mocked(listPlannedMealsBetween).mockResolvedValue([{ ...pastaMeal, plannedFor: CURRENT_WEEK }]);
    renderPanel();

    expect(await screen.findByText("Pasta")).toBeInTheDocument();
    expect(listPlannedMealsBetween).toHaveBeenCalledWith(CURRENT_WEEK, "2026-06-06");
    expect(screen.getByRole("button", { name: /save plan/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /apply from/i })).toBeDisabled();
  });

  it("shows the selected meal count between the arrows and updates it as dates change", async () => {
    vi.mocked(listPlannedMealsBetween).mockImplementation(async (start) =>
      start === CURRENT_WEEK
        ? [{ ...pastaMeal, plannedFor: start }]
        : [
            { ...pastaMeal, plannedFor: start },
            { ...pastaMeal, id: "i2", recipeTitle: "Soup", plannedFor: start },
          ]
    );
    renderPanel();

    const back = screen.getByRole("button", { name: "Move dates back a week" });
    const forward = screen.getByRole("button", { name: "Move dates forward a week" });
    const count = await screen.findByText("1 planned meal in these dates");
    expect(count.parentElement?.previousElementSibling).toBe(back);
    expect(count.parentElement?.nextElementSibling).toBe(forward);

    fireEvent.click(back);
    expect(await screen.findByText("2 planned meals in these dates")).toBeInTheDocument();
    fireEvent.click(forward);
    expect(await screen.findByText("1 planned meal in these dates")).toBeInTheDocument();
  });

  it("picks a range in two taps and highlights it on the calendar", () => {
    renderPanel();
    pickDay("2026-05-18");
    // The first tap starts a single-day range.
    expect(screen.getByTestId("meal-dates-calendar")).toHaveAttribute(
      "data-range",
      "2026-05-18..2026-05-18"
    );

    pickDay("2026-05-24");
    expect(screen.getByTestId("meal-dates-calendar")).toHaveAttribute(
      "data-range",
      "2026-05-18..2026-05-24"
    );
  });

  it("an earlier tap starts the range over", () => {
    renderPanel();
    pickDay("2026-05-20");
    pickDay("2026-05-18"); // before the anchor → restart
    expect(screen.getByTestId("meal-dates-calendar")).toHaveAttribute(
      "data-range",
      "2026-05-18..2026-05-18"
    );
  });

  it("previews the meals planned on the picked dates", async () => {
    vi.mocked(listPlannedMealsBetween).mockResolvedValue([pastaMeal]);
    renderPanel();
    pickDay("2026-05-18");
    pickDay("2026-05-24");
    // The planner can load the preview without inserting a status message.
    expect(screen.queryByText("Loading preview…")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/Pasta/)).toBeInTheDocument(), { timeout: 1500 });
    expect(screen.getByText(/meals in these dates/i)).toBeInTheDocument();
    expect(listPlannedMealsBetween).toHaveBeenCalledWith("2026-05-18", "2026-05-24");
  });

  it("keeps save and apply disabled when the picked dates have no meals", async () => {
    renderPanel();
    pickDay("2026-05-18");
    pickDay("2026-05-24");
    await waitFor(() =>
      expect(listPlannedMealsBetween).toHaveBeenCalledWith("2026-05-18", "2026-05-24"),
    { timeout: 1500 });
    expect(screen.getByRole("button", { name: /save plan/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /apply from/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /view week/i })).toBeEnabled();
    expect(screen.queryByText(/planned meals? in these dates/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/no meals planned on these dates/i)).not.toBeInTheDocument();
  });

  it("dismisses an Apply confirmation when the source range changes", async () => {
    vi.mocked(listPlannedMealsBetween).mockResolvedValue([pastaMeal]);
    renderPanel();
    pickDay("2026-05-18");
    pickDay("2026-05-24");
    const apply = screen.getByRole("button", { name: "Apply from May 31" });
    await waitFor(() => expect(apply).toBeEnabled());
    fireEvent.click(apply);
    expect(screen.getByRole("button", { name: "Confirm apply" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Move dates back a week" }));
    expect(screen.getByLabelText("From")).toHaveValue("2026-05-11");
    expect(screen.getByLabelText("To")).toHaveValue("2026-05-17");
    expect(screen.queryByRole("button", { name: "Confirm apply" })).not.toBeInTheDocument();
  });

  it("starts a new single-day range after completing the previous range", () => {
    renderPanel();
    pickDay("2026-05-18");
    pickDay("2026-05-20");
    pickDay("2026-05-24");
    expect(screen.getByTestId("meal-dates-calendar")).toHaveAttribute(
      "data-range",
      "2026-05-24..2026-05-24"
    );
  });

  it("waits for confirmation before copying the picked dates to an empty week", async () => {
    vi.mocked(listPlannedMealsBetween).mockResolvedValue([pastaMeal]);
    const onCopyRange = vi.fn().mockResolvedValue(undefined);
    renderPanel({ onCopyRange });
    pickDay("2026-05-18");
    pickDay("2026-05-24");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /apply from may 31/i })).toBeEnabled(),
    { timeout: 1500 });

    // The actions sit above the meal list, so long previews never bury them.
    const copyButton = screen.getByRole("button", { name: /apply from may 31/i });
    const mealList = screen.getByText(/Pasta/);
    expect(copyButton.compareDocumentPosition(mealList) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(copyButton);
    expect(onCopyRange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCopyRange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /apply from may 31/i }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm apply" }));
    await waitFor(() =>
      expect(onCopyRange).toHaveBeenCalledWith("2026-05-18", "2026-05-24", "add"),
    { timeout: 1500 });
    await waitFor(() => expect(screen.getByText(/✓ Applied/)).toBeInTheDocument(), { timeout: 1500 });
  });

  it("asks add-or-replace when the current week already has meals", async () => {
    vi.mocked(listPlannedMealsBetween).mockResolvedValue([pastaMeal]);
    const onCopyRange = vi.fn().mockResolvedValue(undefined);
    renderPanel({ currentWeekHasItems: true, onCopyRange });
    pickDay("2026-05-18");
    pickDay("2026-05-24");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /apply from may 31/i })).toBeEnabled(),
    { timeout: 1500 });
    fireEvent.click(screen.getByRole("button", { name: /apply from may 31/i }));

    expect(onCopyRange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /add on top/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /replace existing/i }));
    await waitFor(() =>
      expect(onCopyRange).toHaveBeenCalledWith("2026-05-18", "2026-05-24", "replace"),
    { timeout: 1500 });
  });

  it("saves the picked dates as a new (frozen) meal plan", async () => {
    vi.mocked(listPlannedMealsBetween).mockResolvedValue([pastaMeal]);
    vi.mocked(saveMealsAsPlan).mockResolvedValue({
      id: "sp-new", savedName: "My Plan", startDate: "2026-05-18", endDate: "2026-05-24",
    });

    renderPanel();
    pickDay("2026-05-18");
    pickDay("2026-05-24");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /save plan/i })).toBeEnabled(),
    { timeout: 1500 });

    fireEvent.click(screen.getByRole("button", { name: /save plan/i }));
    expect(screen.queryByRole("group", { name: "Meal plan actions" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/meal plan name/i), {
      target: { value: "My Plan" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(screen.getByText(/saved as "my plan"/i)).toBeInTheDocument(),
    { timeout: 1500 });
    expect(saveMealsAsPlan).toHaveBeenCalledWith("My Plan", "2026-05-18", "2026-05-24");
  });

  it("offers jumping to the picked week when it isn't the current one", async () => {
    vi.mocked(listPlannedMealsBetween).mockResolvedValue([pastaMeal]);
    const { onJumpToWeek } = renderPanel();
    pickDay("2026-05-20");
    pickDay("2026-05-24");
    fireEvent.click(screen.getByRole("button", { name: "View week" }));
    // Keep the selected day so the planner can center its card.
    expect(onJumpToWeek).toHaveBeenCalledWith("2026-05-20");
  });
});

describe("PlanBrowserPanel — Saved plans tab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listPlannedMealsBetween).mockResolvedValue([]);
    vi.mocked(searchSavedMealPlans).mockResolvedValue([]);
  });

  function openSavedTab() {
    renderPanel();
    fireEvent.click(screen.getByRole("tab", { name: /saved plans/i }));
  }

  it("switches to the saved plans tab", () => {
    openSavedTab();
    expect(screen.getByRole("tab", { name: /saved plans/i })).toHaveAttribute("aria-selected", "true");
  });

  it("shows search input on saved plans tab", () => {
    openSavedTab();
    expect(screen.getByPlaceholderText(/search saved plans/i)).toBeInTheDocument();
  });

  it("shows 'No saved plans yet' when the list is empty", async () => {
    openSavedTab();
    await waitFor(() =>
      expect(screen.getByText(/no saved plans yet/i)).toBeInTheDocument(),
    { timeout: 1500 });
  });

  it("renders plan names returned by searchSavedMealPlans", async () => {
    vi.mocked(searchSavedMealPlans).mockResolvedValue([
      { id: "sp1", savedName: "Healthy Week", startDate: "2026-05-18", endDate: "2026-05-24" },
    ]);
    openSavedTab();
    await waitFor(() =>
      expect(screen.getByText("Healthy Week")).toBeInTheDocument(),
    { timeout: 1500 });
  });

  it("filters by search input value", async () => {
    openSavedTab();
    fireEvent.change(screen.getByPlaceholderText(/search saved plans/i), {
      target: { value: "vegan" },
    });
    await waitFor(() =>
      expect(searchSavedMealPlans).toHaveBeenCalledWith("vegan"),
    { timeout: 1500 });
  });

  // Behavior change: the tab now works like the grocery page's. Clicking a
  // plan picks it (the arrow previews it), and Apply sits under the list,
  // disabled until a plan is picked. It used to sit inside the opened plan.
  const HEALTHY = { id: "sp1", savedName: "Healthy Week", startDate: "2026-05-18", endDate: "2026-05-24" };
  const T = { timeout: 1500 };
  const applyButton = () => screen.getByRole("button", { name: /apply from may 31/i });
  const pickHealthy = async () => {
    fireEvent.click(await screen.findByRole("button", { name: /^Healthy Week/ }, T));
  };

  it("shows Apply under the list, disabled until a plan is picked", async () => {
    vi.mocked(searchSavedMealPlans).mockResolvedValue([HEALTHY]);
    openSavedTab();
    const plan = await screen.findByRole("button", { name: /^Healthy Week/ }, T);
    expect(applyButton()).toBeDisabled();
    expect(applyButton()).toHaveClass("btn--small");
    expect(screen.queryByText("Pick a saved plan to apply.")).not.toBeInTheDocument();
    expect(applyButton().compareDocumentPosition(plan) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();

    fireEvent.click(plan);
    expect(plan).toHaveAttribute("aria-pressed", "true");
    expect(applyButton()).toBeEnabled();
  });

  it("previews a plan's meals from its arrow, without picking it", async () => {
    vi.mocked(searchSavedMealPlans).mockResolvedValue([HEALTHY]);
    vi.mocked(previewSavedMealPlan).mockResolvedValue([{ dateIso: "2026-05-18", recipes: ["Pasta"] }]);
    openSavedTab();
    fireEvent.click(await screen.findByRole("button", { name: "Show meals in Healthy Week" }, T));
    expect(screen.queryByText("Loading preview…")).not.toBeInTheDocument();
    expect(await screen.findByText("Pasta", undefined, T)).toBeInTheDocument();
    expect(applyButton()).toBeDisabled();
  });

  it("waits for confirmation before applying the picked plan to an empty week", async () => {
    vi.mocked(searchSavedMealPlans).mockResolvedValue([HEALTHY]);
    const onApplySavedPlan = vi.fn().mockResolvedValue(undefined);
    renderPanel({ onApplySavedPlan });
    fireEvent.click(screen.getByRole("tab", { name: /saved plans/i }));

    await pickHealthy();
    fireEvent.click(applyButton());
    expect(onApplySavedPlan).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onApplySavedPlan).not.toHaveBeenCalled();
    fireEvent.click(applyButton());
    fireEvent.click(screen.getByRole("button", { name: "Confirm apply" }));
    await waitFor(() => expect(onApplySavedPlan).toHaveBeenCalledWith("sp1", "add"), T);
    expect(await screen.findByRole("button", { name: "✓ Applied" }, T)).toBeDisabled();
  });

  it("asks add-or-replace when the week already has meals", async () => {
    vi.mocked(searchSavedMealPlans).mockResolvedValue([HEALTHY]);
    const onApplySavedPlan = vi.fn().mockResolvedValue(undefined);
    renderPanel({ onApplySavedPlan, currentWeekHasItems: true });
    fireEvent.click(screen.getByRole("tab", { name: /saved plans/i }));

    await pickHealthy();
    fireEvent.click(applyButton());
    expect(onApplySavedPlan).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /replace existing/i }));
    await waitFor(() => expect(onApplySavedPlan).toHaveBeenCalledWith("sp1", "replace"), T);
  });

  it("picking another plan after applying offers Apply again", async () => {
    const OTHER = { id: "sp2", savedName: "Quick Week", startDate: "2026-06-01", endDate: "2026-06-07" };
    vi.mocked(searchSavedMealPlans).mockResolvedValue([HEALTHY, OTHER]);
    openSavedTab();

    await pickHealthy();
    fireEvent.click(applyButton());
    fireEvent.click(screen.getByRole("button", { name: "Confirm apply" }));
    await screen.findByRole("button", { name: "✓ Applied" }, T);

    fireEvent.click(screen.getByRole("button", { name: /^Quick Week/ }));
    expect(applyButton()).toBeEnabled();
  });
});
