import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AppHomePage from "../../../app/pages/AppHomePage";
import type { MealType, PlannedMeal } from "../../../features/meal-plans/types";
import type { RecipeDetail, RecipeIngredient } from "../../../features/recipes/types";
import { addDays, toIsoDate } from "../../../lib/utils/dates";
import { renderWithProviders } from "../../utils/renderWithProviders";

vi.mock("../../../features/meal-plans/api", () => ({
  listPlannedMealsBetween: vi.fn(),
  listPlannedMealsForWeek: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../features/recipes/api", () => ({
  getRecipeById: vi.fn(),
  rateRecipe: vi.fn(),
  addRecipeNote: vi.fn(),
  listRecipeNotes: vi.fn().mockResolvedValue([]),
}));

import { listPlannedMealsBetween } from "../../../features/meal-plans/api";
import { addRecipeNote, getRecipeById, rateRecipe } from "../../../features/recipes/api";

// The page works from the real current date, so the fixtures do too.
const today = new Date();
const TODAY = toIsoDate(today);
const YESTERDAY = toIsoDate(addDays(today, -1));

const meal = (id: string, plannedFor: string, mealType: MealType, title: string): PlannedMeal => ({
  id,
  recipeId: `r-${id}`,
  recipeTitle: title,
  plannedFor,
  mealType,
  servingsOverride: null,
  recipeServings: 4,
  effectiveServings: 4,
});

const ingredient = (name: string, category: RecipeIngredient["category"]): RecipeIngredient => ({
  id: name,
  ingredientId: `i-${name}`,
  ingredientName: name,
  quantity: "1",
  unit: "",
  notes: "",
  substituteFor: null,
  category,
});

const recipe = (id: string, title: string, ingredients: RecipeIngredient[], overrides: Partial<RecipeDetail> = {}): RecipeDetail => ({
  id,
  title,
  description: null,
  sourceUrl: null,
  prepMinutes: 15,
  cookMinutes: 30,
  servings: 4,
  tags: [],
  instructions: null,
  rating: null,
  createdAt: "2026-11-01T00:00:00Z",
  ingredients,
  ...overrides,
});

const RECIPES: Record<string, RecipeDetail> = {
  "r-tacos": recipe("r-tacos", "Chicken tacos", [
    ingredient("chicken thighs", "meat_seafood"),
    ingredient("tortillas", "bakery_bread"),
    ingredient("bacon", "meat_seafood"),
  ]),
  "r-oats": recipe("r-oats", "Overnight oats", [ingredient("oats", "pasta_rice_grains")], {
    prepMinutes: 5,
    cookMinutes: null,
  }),
  "r-soup": recipe("r-soup", "Tortellini soup", [ingredient("italian sausage", "meat_seafood")]),
};

const renderHome = () =>
  renderWithProviders(
    <MemoryRouter>
      <AppHomePage />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getRecipeById).mockImplementation(async (recipeId) => RECIPES[recipeId] ?? null);
});

describe("AppHomePage", () => {
  it("previews today's meals in order, with the meat and seafood each uses", async () => {
    vi.mocked(listPlannedMealsBetween).mockResolvedValue([
      meal("tacos", TODAY, "dinner", "Chicken tacos"),
      meal("oats", TODAY, "breakfast", "Overnight oats"),
    ]);
    renderHome();

    const meals = await screen.findAllByRole("listitem");
    expect(meals).toHaveLength(2);

    // Breakfast first, with no meat.
    expect(within(meals[0]!).getByText("Breakfast")).toBeInTheDocument();
    expect(within(meals[0]!).getByRole("link", { name: "Overnight oats" })).toHaveAttribute("href", "/app/recipes/r-oats");
    expect(await within(meals[0]!).findByText("none")).toBeInTheDocument();
    expect(within(meals[0]!).getByText("Serves 4 · 5 min")).toBeInTheDocument();

    // Dinner lists its meats, and links to the recipe and its notes.
    expect(await within(meals[1]!).findByText("chicken thighs, bacon")).toBeInTheDocument();
    expect(within(meals[1]!).getByText("Serves 4 · 45 min")).toBeInTheDocument();
    expect(within(meals[1]!).getByRole("link", { name: "Open recipe" })).toHaveAttribute("href", "/app/recipes/r-tacos");
    expect(within(meals[1]!).getByRole("link", { name: "Notes" })).toHaveAttribute("href", "/app/recipes/r-tacos#notes");
  });

  it("asks only for the last 30 days through today", async () => {
    vi.mocked(listPlannedMealsBetween).mockResolvedValue([]);
    renderHome();
    await screen.findByText("Nothing planned for today.");
    expect(listPlannedMealsBetween).toHaveBeenCalledWith(toIsoDate(addDays(today, -30)), TODAY);
  });

  it("offers to plan a meal when nothing is planned", async () => {
    vi.mocked(listPlannedMealsBetween).mockResolvedValue([]);
    renderHome();

    expect(await screen.findByText("Nothing planned for today.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Plan a meal" })).toHaveAttribute("href", "/app/meal-plans");
    expect(screen.getByText(/No meals planned in the last 30 days/)).toBeInTheDocument();
  });

  it("shows an error when the plan can't load", async () => {
    vi.mocked(listPlannedMealsBetween).mockRejectedValue(new Error("Failed to load planned meals."));
    renderHome();
    expect(await screen.findByText("Failed to load planned meals.")).toBeInTheDocument();
  });

  it("rates the last meal and adds a note to it", async () => {
    const user = userEvent.setup();
    vi.mocked(listPlannedMealsBetween).mockResolvedValue([meal("soup", YESTERDAY, "dinner", "Tortellini soup")]);
    vi.mocked(rateRecipe).mockResolvedValue();
    vi.mocked(addRecipeNote).mockResolvedValue({
      id: "n1",
      body: "Needed more salt.",
      createdAt: "2026-11-19T12:00:00Z",
      updatedAt: "2026-11-19T12:00:00Z",
    });
    renderHome();

    expect(await screen.findByText("Yesterday's dinner")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See all notes" })).toHaveAttribute("href", "/app/recipes/r-soup#notes");

    // Rate it four stars.
    const rating = screen.getByRole("radiogroup", { name: "Rate Tortellini soup" });
    const fourStars = within(rating).getByRole("radio", { name: "Rate 4 stars" });
    // Enabled once the recipe (and its current rating) has loaded.
    await waitFor(() => expect(fourStars).toBeEnabled());
    await user.click(fourStars);
    expect(rateRecipe).toHaveBeenCalledWith("r-soup", 4);

    // Add a note.
    await user.type(screen.getByLabelText("Note on Tortellini soup"), "Needed more salt.");
    await user.click(screen.getByRole("button", { name: "Add note" }));
    expect(addRecipeNote).toHaveBeenCalledWith("r-soup", "Needed more salt.");
    expect(await screen.findByText("Note added.")).toBeInTheDocument();
    expect(screen.getByLabelText("Note on Tortellini soup")).toHaveValue("");
  });
});
