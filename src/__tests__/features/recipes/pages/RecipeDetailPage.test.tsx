import { screen, waitFor } from "@testing-library/react";
import {
  createTestQueryClient,
  renderWithProviders,
  TEST_USER_ID,
} from "../../../utils/renderWithProviders";
import { mealPlanKeys } from "../../../../features/meal-plans/queries";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import RecipeDetailPage from "../../../../features/recipes/pages/RecipeDetailPage";
import { getWeekDays } from "../../../../features/meal-plans/utils/weekDays";
import { getWeekStartIso, shiftWeekStartIso, toIsoDate } from "../../../../lib/utils/dates";

const navigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom"
  );
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

vi.mock("../../../../features/recipes/api", () => ({
  getRecipeById: vi.fn(),
  updateRecipe: vi.fn(),
  deleteRecipe: vi.fn(),
  rateRecipe: vi.fn(),
  // The page shows the recipe's notes under the instructions.
  listRecipeNotes: vi.fn().mockResolvedValue([]),
  addRecipeNote: vi.fn(),
  updateRecipeNote: vi.fn(),
  deleteRecipeNote: vi.fn(),
}));

vi.mock("../../../../features/ingredients/api", () => ({
  createIngredient: vi.fn().mockResolvedValue({
    id: "ingredient-1",
    name: "ground chicken",
    category: "meat_seafood",
    defaultUnit: null,
  }),
  searchIngredients: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../../features/meal-plans/api", () => ({
  addPlannedMeal: vi.fn(),
  listPlannedMealsForWeek: vi.fn(),
}));

import {
  deleteRecipe,
  getRecipeById,
  rateRecipe,
  updateRecipe,
} from "../../../../features/recipes/api";
import { addPlannedMeal, listPlannedMealsForWeek } from "../../../../features/meal-plans/api";

const mockGetRecipeById = vi.mocked(getRecipeById);
const mockUpdateRecipe = vi.mocked(updateRecipe);
const mockDeleteRecipe = vi.mocked(deleteRecipe);
const mockRateRecipe = vi.mocked(rateRecipe);
const mockAddPlannedMeal = vi.mocked(addPlannedMeal);
const mockListPlannedMealsForWeek = vi.mocked(listPlannedMealsForWeek);

const recipe = {
  id: "recipe-1",
  title: "Chicken Caesar Taco Salad",
  description: null,
  sourceUrl: null,
  prepMinutes: null,
  cookMinutes: null,
  servings: 4,
  tags: [],
  instructions: "1. Cook chicken.",
  rating: null,
  createdAt: "2026-05-25T00:00:00Z",
  ingredients: [
    {
      id: "row-1",
      ingredientId: "ingredient-1",
      ingredientName: "ground chicken",
      quantity: "1",
      unit: "lb",
      notes: "",
      substituteFor: null,
      category: "meat_seafood" as const,
    },
  ],
};

const renderPage = (client = createTestQueryClient()) =>
  renderWithProviders(
    <MemoryRouter initialEntries={["/recipes/recipe-1"]}>
      <Routes>
        <Route path="/recipes/:recipeId" element={<RecipeDetailPage />} />
      </Routes>
    </MemoryRouter>,
    { client }
  );

const renderPageWithMealSlot = (mealSlot: { date: string; mealType: string }) =>
  renderWithProviders(
    <MemoryRouter
      initialEntries={[
        {
          pathname: "/recipes/recipe-1",
          state: { from: "meal-planner", mealSlot },
        },
      ]}
    >
      <Routes>
        <Route path="/recipes/:recipeId" element={<RecipeDetailPage />} />
      </Routes>
    </MemoryRouter>
  );

/** Render the detail page reached with `state`, plus a stand-in recipes list
 *  that shows the location state it was returned to with. */
const renderPageArrivingWith = (state: Record<string, unknown> | undefined) =>
  renderWithProviders(
    <MemoryRouter initialEntries={[{ pathname: "/recipes/recipe-1", state }]}>
      <Routes>
        <Route path="/recipes/:recipeId" element={<RecipeDetailPage />} />
        <Route path="/recipes" element={<RecipesListStandIn />} />
        <Route path="/meal-plans" element={<p>Meal planner page</p>} />
      </Routes>
    </MemoryRouter>
  );

function RecipesListStandIn() {
  const location = useLocation();
  return <p>Recipes list page, state: {JSON.stringify(location.state)}</p>;
}

describe("RecipeDetailPage — back links follow how you arrived", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRecipeById.mockResolvedValue(recipe);
    mockListPlannedMealsForWeek.mockResolvedValue([]);
  });

  const backLinkNames = async () => {
    await screen.findByRole("heading", { name: recipe.title }, { timeout: 1500 });
    return screen
      .getAllByRole("link", { name: /^back to/i })
      .map((link) => link.textContent);
  };

  it("from the recipes list: back to recipes only", async () => {
    renderPageArrivingWith(undefined);
    expect(await backLinkNames()).toEqual(["Back to Recipes"]);
  });

  it("opened from a meal on the planner: back to the planner only", async () => {
    renderPageArrivingWith({ from: "meal-planner", plannedMealId: "meal-1", initialServings: 4 });
    expect(await backLinkNames()).toEqual(["Back to Meal Planner"]);
  });

  it("picking a recipe for a planner slot: back to the recipes list or the planner", async () => {
    renderPageArrivingWith({ from: "meal-planner", mealSlot: { date: "2026-11-17", mealType: "dinner" } });
    expect(await backLinkNames()).toEqual(["Back to Recipes", "Back to Meal Planner"]);
  });

  it("going back to the list keeps the slot being picked for", async () => {
    const user = userEvent.setup();
    const mealSlot = { date: "2026-11-17", mealType: "dinner" };
    renderPageArrivingWith({ from: "meal-planner", mealSlot });
    await backLinkNames();

    await user.click(screen.getByRole("link", { name: "Back to Recipes" }));
    // The list gets the slot back, so its "Picking a recipe for…" banner stays.
    expect(
      await screen.findByText(`Recipes list page, state: ${JSON.stringify({ mealSlot })}`)
    ).toBeInTheDocument();
  });
});

describe("RecipeDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRecipeById.mockResolvedValue(recipe);
    mockUpdateRecipe.mockResolvedValue(undefined);
    mockDeleteRecipe.mockResolvedValue(undefined);
    mockRateRecipe.mockResolvedValue(undefined);
    mockListPlannedMealsForWeek.mockResolvedValue([]);
  });

  it("adds the recipe to the meal plan from the detail page", async () => {
    mockAddPlannedMeal.mockResolvedValue({
      id: "item-1",
      recipeId: "recipe-1",
      recipeTitle: "Chicken Caesar Taco Salad",
      plannedFor: "2026-01-01",
      mealType: "dinner",
      servingsOverride: null,
      recipeServings: 4,
      effectiveServings: 4,
    });

    const expectedWeekStartIso = shiftWeekStartIso(getWeekStartIso(new Date(), 0), 1);
    const targetDay = getWeekDays(expectedWeekStartIso)[2];

    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Chicken Caesar Taco Salad");
    await user.click(screen.getByRole("button", { name: "Add to Plan" }));

    expect(
      screen.getByRole("dialog", { name: "Add Chicken Caesar Taco Salad to your meal plan" })
    ).toBeInTheDocument();
    expect(screen.getAllByText("Chicken Caesar Taco Salad").length).toBeGreaterThan(0);

    await user.click(
      await screen.findByRole("button", { name: `Dinner on ${targetDay.fullLabel}` })
    );
    await user.click(screen.getByRole("button", { name: "Add recipe" }));

    await waitFor(() => {
      expect(mockAddPlannedMeal).toHaveBeenCalledWith(
        expect.objectContaining({
          recipeId: "recipe-1",
          plannedFor: targetDay.dateIso,
          mealType: "dinner",
          servingsOverride: null,
        })
      );
    });
    expect(await screen.findByText("Added to your meal plan.")).toBeInTheDocument();
  });

  it("preselects the day and meal from an incoming meal slot when adding to plan", async () => {
    const farFutureDate = new Date();
    farFutureDate.setDate(farFutureDate.getDate() + 30);
    const initialDay = toIsoDate(farFutureDate);
    const expectedDay = getWeekDays(getWeekStartIso(farFutureDate, 0)).find(
      (day) => day.dateIso === initialDay
    );

    const user = userEvent.setup();
    renderPageWithMealSlot({ date: initialDay, mealType: "breakfast" });

    await screen.findByText("Chicken Caesar Taco Salad");
    await user.click(screen.getByRole("button", { name: "Add to Plan" }));

    const slot = await screen.findByRole("button", {
      name: `Breakfast on ${expectedDay?.fullLabel}`,
    });
    expect(slot).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Add recipe" })).toBeEnabled();
  });

  // One sticky Save button at the end of the form (there used to be a second
  // copy fixed to the bottom of the screen, over the phone's bottom nav).
  it("has one sticky save button while editing that submits the edit form", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Chicken Caesar Taco Salad");
    await user.click(screen.getByRole("button", { name: "Edit" }));

    const save = screen.getByRole("button", { name: "Save Changes" });
    expect(save.closest(".recipe-form__actions")).not.toBeNull();
    expect(save.closest("form")).toHaveAttribute("id", "recipe-edit-form");

    await user.click(save);

    await waitFor(() => {
      expect(mockUpdateRecipe).toHaveBeenCalledWith(
        "recipe-1",
        expect.objectContaining({
          title: "Chicken Caesar Taco Salad",
        })
      );
    });
  });

  it("deletes the recipe after confirmation and navigates back to the list", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Chicken Caesar Taco Salad");
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.getByText("Delete this recipe?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));

    await waitFor(() => {
      expect(mockDeleteRecipe).toHaveBeenCalledWith("recipe-1");
    });
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/recipes");
    });
  });

  it("cancels the delete confirmation without deleting", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Chicken Caesar Taco Salad");
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText("Delete this recipe?")).not.toBeInTheDocument();
    expect(mockDeleteRecipe).not.toHaveBeenCalled();
  });

  it("shows an error message when deleting fails", async () => {
    mockDeleteRecipe.mockRejectedValue(new Error("Failed to delete recipe."));
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Chicken Caesar Taco Salad");
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));

    expect(await screen.findByText("Failed to delete recipe.")).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("rates the recipe when a star is clicked", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Chicken Caesar Taco Salad");
    await user.click(screen.getByRole("radio", { name: "Rate 4 stars" }));

    await waitFor(() => {
      expect(mockRateRecipe).toHaveBeenCalledWith("recipe-1", 4);
    });
    expect(screen.getByRole("radio", { name: "Rate 4 stars" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("shows an error and keeps the previous rating when rating fails", async () => {
    mockRateRecipe.mockRejectedValue(new Error("Failed to update rating."));
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Chicken Caesar Taco Salad");
    await user.click(screen.getByRole("radio", { name: "Rate 4 stars" }));

    expect(await screen.findByText("Failed to update rating.")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Rate 4 stars" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
  });

  describe("keeping the meal planner up to date", () => {
    const cachedWeek = mealPlanKeys.week(TEST_USER_ID, "2026-05-25");

    it("marks cached planner weeks stale after saving an edit (titles/servings may change)", async () => {
      const user = userEvent.setup();
      const client = createTestQueryClient();
      client.setQueryData(cachedWeek, []);
      renderPage(client);

      await screen.findByText("Chicken Caesar Taco Salad");
      await user.click(screen.getByRole("button", { name: "Edit" }));
      await user.click(screen.getByRole("button", { name: "Save Changes" }));

      await waitFor(() => expect(client.getQueryState(cachedWeek)?.isInvalidated).toBe(true));
    });

    it("marks cached planner weeks stale after deleting the recipe", async () => {
      const user = userEvent.setup();
      const client = createTestQueryClient();
      client.setQueryData(cachedWeek, []);
      renderPage(client);

      await screen.findByText("Chicken Caesar Taco Salad");
      await user.click(screen.getByRole("button", { name: "Delete" }));
      await user.click(screen.getByRole("button", { name: "Confirm delete" }));

      await waitFor(() => expect(client.getQueryState(cachedWeek)?.isInvalidated).toBe(true));
    });
  });
});
