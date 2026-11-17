import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../../utils/renderWithProviders";
import userEvent from "@testing-library/user-event";
import GroceryPlanBrowser from "../../../../features/grocery/components/GroceryPlanBrowser";
import type { SavedMealPlan } from "../../../../features/meal-plans/types";

// ── Mock the meal-plans API ──────────────────────────────────────────────────

vi.mock("../../../../features/meal-plans/api", () => ({
  searchSavedMealPlans: vi.fn().mockResolvedValue([]),
}));

import { searchSavedMealPlans } from "../../../../features/meal-plans/api";

const mockSearch = vi.mocked(searchSavedMealPlans);

// Enough headroom for the 220 ms saved-plans debounce (mock resolves instantly)
const AFTER_DEBOUNCE = { timeout: 1500 };

// ── Fixtures ─────────────────────────────────────────────────────────────────

const SAVED_PLAN: SavedMealPlan = {
  id: "plan-saved-1",
  savedName: "Summer Meals",
  startDate: "2026-06-01",
  endDate: "2026-06-07",
};

// ── Helper ────────────────────────────────────────────────────────────────────

const toggle = () => screen.getByRole("button", { name: /or use a saved plan/i });

/** Render, then open the panel (it starts closed). */
async function setup({ onSelectSavedPlan = vi.fn() } = {}) {
  const user = userEvent.setup();
  renderWithProviders(<GroceryPlanBrowser onSelectSavedPlan={onSelectSavedPlan} />);
  await user.click(toggle());
  return { user, onSelectSavedPlan };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

// Behavior change: this panel used to have "Past weeks" and "Saved plans"
// tabs. The grocery page now picks dates directly (a date range), so only
// saved plans remain here.
describe("GroceryPlanBrowser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearch.mockResolvedValue([SAVED_PLAN]);
  });

  // Behavior change: the panel used to start open. Building from dates is the
  // usual path, so it now starts closed and opens on demand.
  it("starts closed, without loading saved plans", () => {
    renderWithProviders(<GroceryPlanBrowser onSelectSavedPlan={vi.fn()} />);
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByPlaceholderText(/search saved plans/i)).not.toBeInTheDocument();
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("lists saved plans once opened", async () => {
    await setup();
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByText(SAVED_PLAN.savedName, undefined, AFTER_DEBOUNCE)).toBeInTheDocument();
  });

  it("no longer offers past weeks (the grocery page's date range replaces them)", async () => {
    await setup();
    expect(screen.queryByRole("tab", { name: "Past weeks" })).not.toBeInTheDocument();
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
  });

  it("calls onSelectSavedPlan with the plan when a row is clicked", async () => {
    const onSelectSavedPlan = vi.fn();
    const { user } = await setup({ onSelectSavedPlan });
    await screen.findByText(SAVED_PLAN.savedName, undefined, AFTER_DEBOUNCE);

    await user.click(screen.getByText(SAVED_PLAN.savedName).closest("button")!);

    expect(onSelectSavedPlan).toHaveBeenCalledOnce();
    expect(onSelectSavedPlan).toHaveBeenCalledWith(SAVED_PLAN);
  });

  it("keeps the panel open after choosing, even after several clicks", async () => {
    mockSearch.mockResolvedValue([
      SAVED_PLAN,
      { id: "plan-2", savedName: "Winter Soups", startDate: "2026-12-01", endDate: "2026-12-07" },
    ]);
    const { user } = await setup();
    await screen.findByText("Summer Meals", undefined, AFTER_DEBOUNCE);

    await user.click(screen.getByText("Summer Meals").closest("button")!);
    await user.click(screen.getByText("Winter Soups").closest("button")!);

    expect(toggle()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Summer Meals")).toBeInTheDocument();
  });

  it("searches saved plans by name", async () => {
    const { user } = await setup();
    await user.type(screen.getByPlaceholderText(/search saved plans/i), "summer");
    await waitFor(() => expect(mockSearch).toHaveBeenLastCalledWith("summer"), AFTER_DEBOUNCE);
  });

  it("can be collapsed via the toggle button", async () => {
    const { user } = await setup();
    await screen.findByText(SAVED_PLAN.savedName, undefined, AFTER_DEBOUNCE);

    await user.click(toggle());

    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(SAVED_PLAN.savedName)).not.toBeInTheDocument();
  });
});
