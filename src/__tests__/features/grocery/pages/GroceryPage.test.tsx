import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import GroceryPage from "../../../../features/grocery/pages/GroceryPage";
import type { GroceryItemDraft, GroceryList, GroceryListOrigin } from "../../../../features/grocery/types";
import type { SavedMealPlan } from "../../../../features/meal-plans/types";
import { getWeekEndIso, getWeekStartIso, shiftWeekStartIso } from "../../../../lib/utils/dates";
import { renderWithProviders } from "../../../utils/renderWithProviders";

vi.mock("../../../../features/grocery/api", () => ({
  buildGroceryItemsForRange: vi.fn(),
  buildGroceryItemsForSavedPlan: vi.fn(),
  saveGroceryList: vi.fn(),
  toggleGroceryItem: vi.fn(),
  getGroceryList: vi.fn(),
  listSavedGroceryLists: vi.fn(),
  uncheckAllGroceryItems: vi.fn(),
  renameGroceryList: vi.fn(),
  deleteGroceryList: vi.fn(),
}));

// The saved-plan list searches saved plans and previews the picked one.
vi.mock("../../../../features/meal-plans/api", () => ({
  searchSavedMealPlans: vi.fn(),
  listPlannedMealsBetween: vi.fn(),
  previewSavedMealPlan: vi.fn(),
}));

// Mock the calendar with fixed day buttons; its month grid has its own tests.
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
  buildGroceryItemsForSavedPlan,
  buildGroceryItemsForRange,
  saveGroceryList,
} from "../../../../features/grocery/api";
import {
  listPlannedMealsBetween,
  previewSavedMealPlan,
  searchSavedMealPlans,
} from "../../../../features/meal-plans/api";
import type { PlannedMeal } from "../../../../features/meal-plans/types";

const T = { timeout: 1500 };
const THIS_WEEK = getWeekStartIso(new Date());
const NEXT_WEEK = shiftWeekStartIso(THIS_WEEK, 1);

const RANGE_ITEMS: GroceryItemDraft[] = [
  { ingredientName: "tortillas", quantity: "8", unit: "", category: "bakery_bread", substitutes: [] },
  { ingredientName: "ground beef", quantity: "1", unit: "lb", category: "meat_seafood", substitutes: [] },
];

const SAVED_PLAN: SavedMealPlan = {
  id: "plan-saved",
  savedName: "Lean week",
  startDate: "2026-04-06",
  endDate: "2026-04-12",
};
const SAVED_PLAN_ITEMS: GroceryItemDraft[] = [
  { ingredientName: "lettuce", quantity: "1", unit: "head", category: "produce", substitutes: [] },
  { ingredientName: "chicken breast", quantity: "2", unit: "lb", category: "meat_seafood", substitutes: [] },
  { ingredientName: "olive oil", quantity: "", unit: "", category: null, substitutes: [] },
];

function savedListFor(origin: GroceryListOrigin, items: GroceryItemDraft[]): GroceryList {
  return {
    id: "list-1",
    title: "Groceries",
    savedPlanId: origin.kind === "saved_plan" ? origin.savedPlanId : null,
    startDate: origin.kind === "range" ? origin.startDate : null,
    endDate: origin.kind === "range" ? origin.endDate : null,
    createdAt: "2026-05-25T12:00:00Z",
    items: items.map((item, i) => ({ ...item, id: `item-${i}`, isChecked: false })),
  };
}

function renderPage(
  initialEntries?: Parameters<typeof MemoryRouter>[0]["initialEntries"]
) {
  renderWithProviders(
    <MemoryRouter initialEntries={initialEntries}>
      <GroceryPage />
    </MemoryRouter>
  );
}

const build = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: "Build Grocery List" }));

async function save(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Save list…" }));
  await user.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(saveGroceryList).toHaveBeenCalledTimes(1), T);
  return vi.mocked(saveGroceryList).mock.calls[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(searchSavedMealPlans).mockResolvedValue([SAVED_PLAN]);
  vi.mocked(listPlannedMealsBetween).mockResolvedValue([]);
  vi.mocked(previewSavedMealPlan).mockResolvedValue([]);
  vi.mocked(buildGroceryItemsForRange).mockResolvedValue(RANGE_ITEMS);
  vi.mocked(buildGroceryItemsForSavedPlan).mockResolvedValue(SAVED_PLAN_ITEMS);
  vi.mocked(saveGroceryList).mockImplementation(async (_title, origin, items) => savedListFor(origin, items));
});

describe("GroceryPage — building from dates", () => {
  it("defaults to this week, builds from those dates, and saves the list with that range", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByLabelText("From")).toHaveValue(THIS_WEEK);
    expect(screen.getByLabelText("To")).toHaveValue(getWeekEndIso(THIS_WEEK));

    await build(user);
    for (const item of RANGE_ITEMS) {
      expect(await screen.findByText(item.ingredientName, undefined, T)).toBeInTheDocument();
    }
    expect(buildGroceryItemsForRange).toHaveBeenCalledWith(THIS_WEEK, getWeekEndIso(THIS_WEEK));

    const [, origin, items] = await save(user);
    expect(origin).toEqual({ kind: "range", startDate: THIS_WEEK, endDate: getWeekEndIso(THIS_WEEK) });
    expect(items).toEqual(RANGE_ITEMS);
  });

  it("builds from any dates you pick, of any length", async () => {
    const user = userEvent.setup();
    renderPage();

    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-05-28" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-06-08" } });
    await build(user);
    await screen.findByText("tortillas", undefined, T);

    expect(buildGroceryItemsForRange).toHaveBeenCalledWith("2026-05-28", "2026-06-08");
    const [title, origin] = await save(user);
    expect(origin).toEqual({ kind: "range", startDate: "2026-05-28", endDate: "2026-06-08" });
    expect(title).toBe("Grocery – May 28, 2026 – Jun 8, 2026");
  });

  // The This week / Next week presets were removed with the always-open
  // calendar; the arrows still move the range a week at a time.
  it("the arrows move the range a week at a time", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Move dates forward a week" }));
    expect(screen.getByLabelText("From")).toHaveValue(NEXT_WEEK);
    expect(screen.getByLabelText("To")).toHaveValue(getWeekEndIso(NEXT_WEEK));

    await user.click(screen.getByRole("button", { name: "Move dates back a week" }));
    expect(screen.getByLabelText("From")).toHaveValue(THIS_WEEK);
  });

  it("moving the start past the end pulls the end along", () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2099-01-10" } });
    expect(screen.getByLabelText("To")).toHaveValue("2099-01-10");
  });

  it("can't be given a backwards range: the end pulls the start along", () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-06-10" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-06-01" } });
    expect(screen.getByLabelText("From")).toHaveValue("2026-06-01");
    expect(screen.getByRole("button", { name: "Build Grocery List" })).toBeEnabled();
  });

  it("offers no save when the dates have no meals", async () => {
    vi.mocked(buildGroceryItemsForRange).mockResolvedValue([]);
    const user = userEvent.setup();
    renderPage();

    await build(user);

    expect(await screen.findByText(/No ingredients found/, undefined, T)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save list…" })).not.toBeInTheDocument();
  });
});

describe("GroceryPage — ticking items before saving", () => {
  it("checks and unchecks just the item clicked on an unsaved list", async () => {
    const user = userEvent.setup();
    renderPage();
    await build(user);

    const beef = await screen.findByRole("checkbox", { name: /ground beef/ }, T);
    const tortillas = screen.getByRole("checkbox", { name: /tortillas/ });
    await user.click(beef);
    expect(beef).toBeChecked();
    expect(tortillas).not.toBeChecked();
    expect(screen.getByText("1/2 checked")).toBeInTheDocument();

    await user.click(beef);
    expect(beef).not.toBeChecked();
    expect(screen.getByText("0/2 checked")).toBeInTheDocument();
  });

  it("starts a rebuilt list fresh, with nothing ticked", async () => {
    const user = userEvent.setup();
    renderPage();
    await build(user);
    await user.click(await screen.findByRole("checkbox", { name: /ground beef/ }, T));
    expect(screen.getByText("1/2 checked")).toBeInTheDocument();

    await build(user);
    expect(await screen.findByText("0/2 checked", undefined, T)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /ground beef/ })).not.toBeChecked();
  });
});

describe("GroceryPage — building from a saved plan", () => {
  it("builds from the chosen saved plan and saves the list linked to it, with every item", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("tab", { name: "Saved plans" }));
    await user.click(await screen.findByRole("button", { name: /^Lean week/ }, T));
    await build(user);
    for (const item of SAVED_PLAN_ITEMS) {
      expect(await screen.findByText(item.ingredientName, undefined, T)).toBeInTheDocument();
    }
    expect(buildGroceryItemsForSavedPlan).toHaveBeenCalledWith("plan-saved");
    expect(buildGroceryItemsForRange).not.toHaveBeenCalled();

    const [title, origin, items] = await save(user);
    expect(origin).toEqual({ kind: "saved_plan", savedPlanId: "plan-saved" });
    expect(items).toEqual(SAVED_PLAN_ITEMS);
    expect(title).toContain("Lean week");
  });

  it("never mixes sources: switching to a saved plan clears the dates' list, and saving uses only the plan", async () => {
    const user = userEvent.setup();
    renderPage();

    await build(user);
    expect(await screen.findByText("tortillas", undefined, T)).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Saved plans" }));
    await user.click(await screen.findByRole("button", { name: /^Lean week/ }, T));
    expect(screen.queryByText("tortillas")).not.toBeInTheDocument();

    await build(user);
    expect(await screen.findByText("lettuce", undefined, T)).toBeInTheDocument();
    expect(screen.queryByText("tortillas")).not.toBeInTheDocument();

    const [, origin, items] = await save(user);
    expect(origin).toEqual({ kind: "saved_plan", savedPlanId: "plan-saved" });
    expect(items).toEqual(SAVED_PLAN_ITEMS);
  });

  // The "← Back to dates" button was replaced by the Browse plans tabs:
  // each tab keeps its own choice, and the open tab is what gets built.
  it("switching back to the Calendar tab builds from the dates you had", async () => {
    const user = userEvent.setup();
    renderPage();
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-05-28" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-06-08" } });

    await user.click(screen.getByRole("tab", { name: "Saved plans" }));
    await user.click(await screen.findByRole("button", { name: /^Lean week/ }, T));
    await user.click(screen.getByRole("tab", { name: "Calendar" }));

    expect(screen.getByLabelText("From")).toHaveValue("2026-05-28");
    await build(user);
    await waitFor(() =>
      expect(buildGroceryItemsForRange).toHaveBeenCalledWith("2026-05-28", "2026-06-08"), T
    );
    expect(buildGroceryItemsForSavedPlan).not.toHaveBeenCalled();
  });

  it("can't build from the Saved plans tab until a plan is picked", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("tab", { name: "Saved plans" }));
    expect(screen.getByRole("button", { name: "Build Grocery List" })).toBeDisabled();
    expect(screen.getByText("Pick a saved plan to build from.")).toBeInTheDocument();

    // Behavior change: clicking a plan only picks it (aria-pressed); its
    // meals preview opens from the separate arrow button instead.
    const plan = await screen.findByRole("button", { name: /^Lean week/ }, T);
    await user.click(plan);
    expect(plan).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Show meals in Lean week" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Build Grocery List" })).toBeEnabled();
  });

  it("opens and closes a plan's meals preview with its arrow, without picking it", async () => {
    vi.mocked(previewSavedMealPlan).mockResolvedValue([
      { dateIso: "2026-06-01", recipes: ["Chili", "Salad"] },
    ]);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("tab", { name: "Saved plans" }));
    await user.click(await screen.findByRole("button", { name: "Show meals in Lean week" }, T));
    expect(await screen.findByText("Chili · Salad", undefined, T)).toBeInTheDocument();
    expect(previewSavedMealPlan).toHaveBeenCalledWith("plan-saved");
    expect(screen.getByRole("button", { name: /^Lean week/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Build Grocery List" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Hide meals in Lean week" }));
    expect(screen.queryByText("Chili · Salad")).not.toBeInTheDocument();
  });

  it("clicking the picked plan again keeps it picked and keeps its built list", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("tab", { name: "Saved plans" }));
    const plan = await screen.findByRole("button", { name: /^Lean week/ }, T);
    await user.click(plan);
    await build(user);
    expect(await screen.findByText("lettuce", undefined, T)).toBeInTheDocument();

    await user.click(plan);
    expect(plan).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("lettuce")).toBeInTheDocument();
  });

  it("puts Build below the saved plans list", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("tab", { name: "Saved plans" }));
    const plan = await screen.findByRole("button", { name: /^Lean week/ }, T);
    const buildBtn = screen.getByRole("button", { name: "Build Grocery List" });
    expect(buildBtn.compareDocumentPosition(plan) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  it("keeps the picked plan when you switch tabs and come back", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("tab", { name: "Saved plans" }));
    await user.click(await screen.findByRole("button", { name: /^Lean week/ }, T));
    await user.click(screen.getByRole("tab", { name: "Calendar" }));
    await user.click(screen.getByRole("tab", { name: "Saved plans" }));

    expect(await screen.findByRole("button", { name: /^Lean week/ }, T)).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Build Grocery List" })).toBeEnabled();
  });
});

describe("GroceryPage — Browse plans card", () => {
  it("has the planner's heading and tabs, opening on Calendar", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Browse plans" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Calendar" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Saved plans" })).toHaveAttribute("aria-selected", "false");
  });

  // Coming back from the Saved Meal Plans page.
  it("opens on the Saved plans tab when asked to", () => {
    renderPage([{ pathname: "/app/grocery", state: { planBrowserTab: "saved" } }]);
    expect(screen.getByRole("tab", { name: "Saved plans" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("link", { name: "Manage saved plans" })).toBeInTheDocument();
  });

  it("keeps Build Grocery List visible under both tabs", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(screen.getByRole("button", { name: "Build Grocery List" })).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Saved plans" }));
    expect(screen.getByRole("button", { name: "Build Grocery List" })).toBeInTheDocument();
  });
});

describe("GroceryPage — planned meal count", () => {
  const plannedMeal = (id: string, plannedFor: string): PlannedMeal => ({
    id,
    recipeId: `recipe-${id}`,
    recipeTitle: "Tacos",
    plannedFor,
    mealType: "dinner",
    servingsOverride: null,
    recipeServings: 4,
    effectiveServings: 4,
  });

  it("shows how many meals are planned in the chosen dates", async () => {
    vi.mocked(listPlannedMealsBetween).mockResolvedValue([
      plannedMeal("a", THIS_WEEK),
      plannedMeal("b", THIS_WEEK),
      plannedMeal("c", THIS_WEEK),
    ]);
    renderPage();

    expect(await screen.findByText("3 planned meals in these dates", undefined, T)).toBeInTheDocument();
    // The same meals the grocery list will be built from.
    expect(listPlannedMealsBetween).toHaveBeenCalledWith(THIS_WEEK, getWeekEndIso(THIS_WEEK));
  });

  it("uses the singular for one meal, and says when there are none", async () => {
    vi.mocked(listPlannedMealsBetween).mockImplementation(async (start) =>
      start === THIS_WEEK ? [plannedMeal("a", THIS_WEEK)] : []
    );
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("1 planned meal in these dates", undefined, T)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Move dates forward a week" }));
    expect(await screen.findByText("No meals planned for these dates", undefined, T)).toBeInTheDocument();
  });

  it("updates when the dates change", async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-05-28" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-06-08" } });

    await waitFor(() =>
      expect(listPlannedMealsBetween).toHaveBeenCalledWith("2026-05-28", "2026-06-08"), T
    );
  });

  // (The backwards-range case is gone: the picker can't produce one.)
  it("isn't shown for a saved plan", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("No meals planned for these dates", undefined, T);

    await user.click(screen.getByRole("tab", { name: "Saved plans" }));
    await user.click(await screen.findByRole("button", { name: /^Lean week/ }, T));
    expect(screen.queryByText(/planned for these dates|in these dates/)).not.toBeInTheDocument();
  });
});

describe("GroceryPage — picking the dates on a calendar", () => {
  beforeEach(() => {
    vi.mocked(searchSavedMealPlans).mockResolvedValue([]);
    vi.mocked(listPlannedMealsBetween).mockResolvedValue([]);
  });

  const pickDay = (iso: string) =>
    fireEvent.click(screen.getByRole("button", { name: `Day ${iso}` }));

  it("is always open under the date fields", () => {
    renderPage();
    expect(screen.getByTestId("meal-dates-calendar")).toBeInTheDocument();
  });

  it("fills From and To with two taps, sharing the panel's picking rules", () => {
    renderPage();

    pickDay("2026-05-18");
    // First tap: a single-day range, waiting for the last day.
    expect(screen.getByLabelText("From")).toHaveValue("2026-05-18");
    expect(screen.getByLabelText("To")).toHaveValue("2026-05-18");
    expect(screen.getByText(/tap the last day/i)).toBeInTheDocument();

    pickDay("2026-05-24");
    expect(screen.getByLabelText("From")).toHaveValue("2026-05-18");
    expect(screen.getByLabelText("To")).toHaveValue("2026-05-24");
    expect(screen.queryByText(/tap the last day/i)).not.toBeInTheDocument();
    // The calendar highlights what the inputs hold.
    expect(screen.getByTestId("meal-dates-calendar")).toHaveAttribute(
      "data-range",
      "2026-05-18..2026-05-24"
    );
  });

  it("an earlier tap starts the range over", () => {
    renderPage();
    pickDay("2026-05-20");
    pickDay("2026-05-18");
    expect(screen.getByLabelText("From")).toHaveValue("2026-05-18");
    expect(screen.getByLabelText("To")).toHaveValue("2026-05-18");
    expect(screen.getByText(/tap the last day/i)).toBeInTheDocument();
  });

  it("builds the grocery list from the picked dates", async () => {
    vi.mocked(buildGroceryItemsForRange).mockResolvedValue(RANGE_ITEMS);
    renderPage();
    pickDay("2026-05-18");
    pickDay("2026-05-24");

    fireEvent.click(screen.getByRole("button", { name: /build grocery list/i }));
    await waitFor(() =>
      expect(buildGroceryItemsForRange).toHaveBeenCalledWith("2026-05-18", "2026-05-24"), T
    );
  });

  it("editing a date input forgets a pending first tap", () => {
    renderPage();
    pickDay("2026-05-20");
    expect(screen.getByText(/tap the last day/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-06-01" } });
    expect(screen.queryByText(/tap the last day/i)).not.toBeInTheDocument();
  });
});
