import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { renderWithProviders } from "../../utils/renderWithProviders";
import SavedPlanList from "../../../features/meal-plans/components/SavedPlanList";
import SavedMealPlansPage from "../../../features/meal-plans/pages/SavedMealPlansPage";
import { opensSavedPlansTab } from "../../../features/meal-plans/utils/savedPlansNavigation";

vi.mock("../../../features/meal-plans/api", () => ({
  searchSavedMealPlans: vi.fn().mockResolvedValue([]),
  listSavedMealPlans: vi.fn().mockResolvedValue([]),
  previewSavedMealPlan: vi.fn(),
  renameSavedMealPlan: vi.fn(),
  deleteSavedMealPlan: vi.fn(),
}));

/** Stands in for the planner or grocery page: its Saved plans tab. */
function PageWithSavedPlansTab({ name }: { name: string }) {
  const location = useLocation();
  return (
    <div>
      <h1>{name}</h1>
      <p>{opensSavedPlansTab(location.state) ? "Saved plans tab open" : "Calendar tab open"}</p>
      <SavedPlanList selectedPlanId={null} onSelectedPlanChange={() => {}} />
    </div>
  );
}

function renderApp(startPath: string) {
  renderWithProviders(
    <MemoryRouter initialEntries={[startPath]}>
      <Routes>
        <Route path="/meal-plans" element={<PageWithSavedPlansTab name="Planner page" />} />
        <Route path="/grocery" element={<PageWithSavedPlansTab name="Grocery page" />} />
        <Route path="/saved-meal-plans" element={<SavedMealPlansPage />} />
      </Routes>
    </MemoryRouter>
  );
}

// Manage → Saved Meal Plans → back: returns to the page you came from, with
// its Saved plans tab open again.
describe("Saved plans round trip", () => {
  it("from the planner, comes back to the planner's Saved plans tab", async () => {
    const user = userEvent.setup();
    renderApp("/meal-plans");
    expect(screen.getByText("Calendar tab open")).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Manage saved plans" }));
    expect(await screen.findByRole("heading", { name: "Saved Meal Plans" })).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Back to Meal Plans" }));
    expect(screen.getByRole("heading", { name: "Planner page" })).toBeInTheDocument();
    expect(screen.getByText("Saved plans tab open")).toBeInTheDocument();
  });

  it("from the grocery page, comes back to grocery's Saved plans tab", async () => {
    const user = userEvent.setup();
    renderApp("/grocery");

    await user.click(screen.getByRole("link", { name: "Manage saved plans" }));
    await user.click(await screen.findByRole("link", { name: "Back to Grocery Lists" }));
    expect(screen.getByRole("heading", { name: "Grocery page" })).toBeInTheDocument();
    expect(screen.getByText("Saved plans tab open")).toBeInTheDocument();
  });

  it("visiting Saved Meal Plans directly links back to the planner's Saved plans tab", async () => {
    const user = userEvent.setup();
    renderApp("/saved-meal-plans");
    await user.click(screen.getByRole("link", { name: "Back to Meal Plans" }));
    expect(screen.getByRole("heading", { name: "Planner page" })).toBeInTheDocument();
    expect(screen.getByText("Saved plans tab open")).toBeInTheDocument();
  });
});
