import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import GroceryPage from "../../../../features/grocery/pages/GroceryPage";
import type { GroceryItemDraft, GroceryList } from "../../../../features/grocery/types";
import type { SavedMealPlan } from "../../../../features/meal-plans/types";
import { getWeekStartIso } from "../../../../lib/utils/dates";
import { renderWithProviders } from "../../../utils/renderWithProviders";

vi.mock("../../../../features/grocery/api", () => ({
  buildGroceryItemsForWeek: vi.fn(),
  buildGroceryItemsForPlan: vi.fn(),
  saveGroceryList: vi.fn(),
  toggleGroceryItem: vi.fn(),
  getGroceryList: vi.fn(),
  listSavedGroceryLists: vi.fn(),
  uncheckAllGroceryItems: vi.fn(),
  renameGroceryList: vi.fn(),
  deleteGroceryList: vi.fn(),
}));

// The plan picker (GroceryPlanBrowser) loads past weeks and saved plans.
vi.mock("../../../../features/meal-plans/api", () => ({
  listMealPlanSpans: vi.fn(),
  searchSavedMealPlans: vi.fn(),
}));

import {
  buildGroceryItemsForPlan,
  buildGroceryItemsForWeek,
  saveGroceryList,
} from "../../../../features/grocery/api";
import { listMealPlanSpans, searchSavedMealPlans } from "../../../../features/meal-plans/api";

const T = { timeout: 1500 };
const THIS_WEEK = getWeekStartIso(new Date());

const WEEK_ITEMS: GroceryItemDraft[] = [
  { ingredientName: "tortillas", quantity: "8", unit: "", category: "bakery & bread" },
  { ingredientName: "ground beef", quantity: "1", unit: "lb", category: "meat & seafood" },
];

const SAVED_PLAN: SavedMealPlan = {
  id: "plan-saved",
  savedName: "Lean week",
  startDate: "2026-04-06",
  endDate: "2026-04-12",
};
const SAVED_PLAN_ITEMS: GroceryItemDraft[] = [
  { ingredientName: "lettuce", quantity: "1", unit: "head", category: "produce" },
  { ingredientName: "chicken breast", quantity: "2", unit: "lb", category: "meat & seafood" },
  { ingredientName: "olive oil", quantity: "", unit: "", category: null },
];

function savedListFor(mealPlanId: string, items: GroceryItemDraft[]): GroceryList {
  return {
    id: "list-1",
    title: "Groceries",
    mealPlanId,
    createdAt: "2026-05-25T12:00:00Z",
    items: items.map((item, i) => ({ ...item, id: `item-${i}`, isChecked: false })),
  };
}

function renderPage() {
  renderWithProviders(
    <MemoryRouter>
      <GroceryPage />
    </MemoryRouter>
  );
}

async function buildAndSave(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Save list…" }));
  await user.click(screen.getByRole("button", { name: "Save" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listMealPlanSpans).mockResolvedValue([]);
  vi.mocked(searchSavedMealPlans).mockResolvedValue([SAVED_PLAN]);
  vi.mocked(buildGroceryItemsForWeek).mockResolvedValue({ items: WEEK_ITEMS, planId: "plan-week" });
  vi.mocked(buildGroceryItemsForPlan).mockResolvedValue(SAVED_PLAN_ITEMS);
  vi.mocked(saveGroceryList).mockImplementation(async (_title, mealPlanId, items) =>
    savedListFor(mealPlanId ?? "", items)
  );
});

describe("GroceryPage — list comes from, and is saved against, the chosen plan", () => {
  it("builds from the selected week's plan and saves the list linked to it, with every item", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Build Grocery List" }));

    for (const item of WEEK_ITEMS) {
      expect(await screen.findByText(item.ingredientName, undefined, T)).toBeInTheDocument();
    }
    expect(buildGroceryItemsForWeek).toHaveBeenCalledWith(THIS_WEEK);
    expect(buildGroceryItemsForPlan).not.toHaveBeenCalled();

    await buildAndSave(user);

    await waitFor(() => expect(saveGroceryList).toHaveBeenCalledTimes(1), T);
    const [, mealPlanId, items] = vi.mocked(saveGroceryList).mock.calls[0];
    expect(mealPlanId).toBe("plan-week");
    expect(items).toEqual(WEEK_ITEMS);
  });

  it("builds from a chosen saved plan and saves the list linked to that plan, with every item", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("tab", { name: "Saved plans" }));
    await user.click(await screen.findByRole("button", { name: /Lean week/ }, T));
    await user.click(screen.getByRole("button", { name: "Build Grocery List" }));

    for (const item of SAVED_PLAN_ITEMS) {
      expect(await screen.findByText(item.ingredientName, undefined, T)).toBeInTheDocument();
    }
    expect(buildGroceryItemsForPlan).toHaveBeenCalledWith("plan-saved");
    expect(buildGroceryItemsForWeek).not.toHaveBeenCalled();

    await buildAndSave(user);

    await waitFor(() => expect(saveGroceryList).toHaveBeenCalledTimes(1), T);
    const [title, mealPlanId, items] = vi.mocked(saveGroceryList).mock.calls[0];
    expect(mealPlanId).toBe("plan-saved");
    expect(items).toEqual(SAVED_PLAN_ITEMS);
    expect(title).toContain("Lean week");
  });

  it("never mixes plans: switching plans clears the old list, and saving uses only the new plan", async () => {
    const user = userEvent.setup();
    renderPage();

    // Build from this week first...
    await user.click(screen.getByRole("button", { name: "Build Grocery List" }));
    expect(await screen.findByText("tortillas", undefined, T)).toBeInTheDocument();

    // ...then switch to a saved plan: the week's items must disappear.
    await user.click(screen.getByRole("tab", { name: "Saved plans" }));
    await user.click(await screen.findByRole("button", { name: /Lean week/ }, T));
    expect(screen.queryByText("tortillas")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Build Grocery List" }));
    expect(await screen.findByText("lettuce", undefined, T)).toBeInTheDocument();
    expect(screen.queryByText("tortillas")).not.toBeInTheDocument();

    await buildAndSave(user);

    await waitFor(() => expect(saveGroceryList).toHaveBeenCalledTimes(1), T);
    const [, mealPlanId, items] = vi.mocked(saveGroceryList).mock.calls[0];
    expect(mealPlanId).toBe("plan-saved");
    expect(items).toEqual(SAVED_PLAN_ITEMS);
  });

  it("offers no save when the chosen week has no plan (nothing to link or list)", async () => {
    vi.mocked(buildGroceryItemsForWeek).mockResolvedValue({ items: [], planId: null });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Build Grocery List" }));

    expect(await screen.findByText(/No ingredients found for this plan/, undefined, T)).toBeInTheDocument();
    // Nothing to save, so there's no way to save an unlinked, empty list.
    expect(screen.queryByRole("button", { name: "Save list…" })).not.toBeInTheDocument();
  });
});
