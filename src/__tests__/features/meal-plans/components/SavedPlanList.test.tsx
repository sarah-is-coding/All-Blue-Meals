import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../../utils/renderWithProviders";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import SavedPlanList from "../../../../features/meal-plans/components/SavedPlanList";
import type { SavedMealPlan } from "../../../../features/meal-plans/types";

vi.mock("../../../../features/meal-plans/api", () => ({
  searchSavedMealPlans: vi.fn(),
  previewSavedMealPlan: vi.fn(),
}));

import { previewSavedMealPlan, searchSavedMealPlans } from "../../../../features/meal-plans/api";

const mockSearch = vi.mocked(searchSavedMealPlans);
const mockPreview = vi.mocked(previewSavedMealPlan);

// Enough headroom for the 220 ms search debounce (mocks resolve instantly)
const T = { timeout: 1500 };

const SUMMER: SavedMealPlan = {
  id: "plan-1",
  savedName: "Summer Meals",
  startDate: "2026-06-01",
  endDate: "2026-06-07",
};
const WINTER: SavedMealPlan = {
  id: "plan-2",
  savedName: "Winter Soups",
  startDate: "2026-12-01",
  endDate: "2026-12-07",
};

function renderList(props: Partial<Parameters<typeof SavedPlanList>[0]> = {}) {
  const user = userEvent.setup();
  const onSelectedPlanChange = vi.fn();
  renderWithProviders(
    <MemoryRouter>
      <SavedPlanList selectedPlanId={null} onSelectedPlanChange={onSelectedPlanChange} {...props} />
    </MemoryRouter>
  );
  return { user, onSelectedPlanChange };
}

const planButton = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}`) });

// The shared saved-plans list behind both Saved plans tabs (planner and
// grocery). Behavior change: the planner used to open a plan on click (with
// Apply inside it); now both pages pick on click and preview from the arrow.
describe("SavedPlanList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearch.mockResolvedValue([SUMMER, WINTER]);
    mockPreview.mockResolvedValue([]);
  });

  it("lists saved plans with their dates", async () => {
    renderList();
    expect(await screen.findByText(SUMMER.savedName, undefined, T)).toBeInTheDocument();
    expect(screen.getByText(WINTER.savedName)).toBeInTheDocument();
    expect(planButton(SUMMER.savedName)).toHaveTextContent("Jun 1, 2026");
  });

  it("picks a plan on click without opening its preview", async () => {
    const { user, onSelectedPlanChange } = renderList();
    await screen.findByText(SUMMER.savedName, undefined, T);
    await user.click(planButton(SUMMER.savedName));
    expect(onSelectedPlanChange).toHaveBeenCalledWith(SUMMER);
    expect(mockPreview).not.toHaveBeenCalled();
  });

  it("marks only the picked plan", async () => {
    renderList({ selectedPlanId: WINTER.id });
    await screen.findByText(WINTER.savedName, undefined, T);
    expect(planButton(WINTER.savedName)).toHaveAttribute("aria-pressed", "true");
    expect(planButton(WINTER.savedName)).toHaveClass("saved-plan-list__btn--active");
    expect(planButton(SUMMER.savedName)).toHaveAttribute("aria-pressed", "false");
  });

  it("opens and closes a plan's preview with its arrow, one plan at a time", async () => {
    mockPreview.mockResolvedValue([
      { dateIso: "2026-12-01", recipes: ["Minestrone", "Bread"] },
      { dateIso: "2026-12-02", recipes: [] },
    ]);
    const { user, onSelectedPlanChange } = renderList();

    await user.click(await screen.findByRole("button", { name: "Show meals in Winter Soups" }, T));
    expect(await screen.findByText("Minestrone · Bread", undefined, T)).toBeInTheDocument();
    expect(screen.getByText("Tue, Dec 1")).toBeInTheDocument();
    expect(mockPreview).toHaveBeenCalledWith(WINTER.id);
    expect(onSelectedPlanChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Show meals in Summer Meals" }));
    expect(screen.getByRole("button", { name: "Show meals in Winter Soups" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Hide meals in Summer Meals" })).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("button", { name: "Hide meals in Summer Meals" }));
    expect(screen.queryByText("No meals in this plan.")).not.toBeInTheDocument();
  });

  it("says when a previewed plan has no meals", async () => {
    const { user } = renderList();
    await user.click(await screen.findByRole("button", { name: "Show meals in Summer Meals" }, T));
    expect(await screen.findByText("No meals in this plan.", undefined, T)).toBeInTheDocument();
  });

  it("shows a preview error", async () => {
    mockPreview.mockRejectedValue(new Error("Preview failed"));
    const { user } = renderList();
    await user.click(await screen.findByRole("button", { name: "Show meals in Summer Meals" }, T));
    expect(await screen.findByText("Preview failed", undefined, T)).toBeInTheDocument();
  });

  it("shows the page's action under the list", async () => {
    renderList({ belowList: <button type="button">Build</button> });
    const lastPlan = await screen.findByText(WINTER.savedName, undefined, T);
    const action = screen.getByRole("button", { name: "Build" });
    expect(action.compareDocumentPosition(lastPlan) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  // It manages the whole list, so it sits with the search, above the plans
  // and away from the page's action.
  it("links to the saved plans page from beside the search box", async () => {
    renderList({ belowList: <button type="button">Build</button> });
    const link = screen.getByRole("link", { name: "Manage saved plans" });
    expect(link).toHaveAttribute("href", "/saved-meal-plans");
    expect(link).toHaveTextContent("Manage");
    const firstPlan = await screen.findByText(SUMMER.savedName, undefined, T);
    expect(link.compareDocumentPosition(firstPlan) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("searches saved plans by name", async () => {
    const { user } = renderList();
    await user.type(screen.getByPlaceholderText(/search saved plans/i), "summer");
    await waitFor(() => expect(mockSearch).toHaveBeenLastCalledWith("summer"), T);
  });

  it("says when there are no saved plans, or none match", async () => {
    mockSearch.mockResolvedValue([]);
    const { user } = renderList();
    expect(await screen.findByText("No saved plans yet.", undefined, T)).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/search saved plans/i), "zzz");
    expect(await screen.findByText("No saved plans match.", undefined, T)).toBeInTheDocument();
  });
});
