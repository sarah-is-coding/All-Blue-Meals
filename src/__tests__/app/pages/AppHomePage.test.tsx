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
import { addRecipeNote, getRecipeById, listRecipeNotes, rateRecipe } from "../../../features/recipes/api";

// The page works from the real current date, so the fixtures do too.
const today = new Date();
const TODAY = toIsoDate(today);
const YESTERDAY = toIsoDate(addDays(today, -1));
const TOMORROW = toIsoDate(addDays(today, 1));

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
  "r-kebabs": recipe("r-kebabs", "Lamb kebabs", [ingredient("lamb shoulder", "meat_seafood")], {
    tags: ["grill", "summer", "Marinate overnight", "greek", "party"],
  }),
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
  // Some tests give recipes notes; clearAllMocks keeps implementations, so reset.
  vi.mocked(listRecipeNotes).mockResolvedValue([]);
});

describe("AppHomePage", () => {
  it("previews today's meals in order, with the meat and seafood each uses", async () => {
    vi.mocked(listPlannedMealsBetween).mockResolvedValue([
      meal("tacos", TODAY, "dinner", "Chicken tacos"),
      meal("oats", TODAY, "breakfast", "Overnight oats"),
    ]);
    renderHome();

    const todayList = await screen.findByRole("list", { name: "Today's meals" });
    const meals = within(todayList).getAllByRole("listitem");
    expect(meals).toHaveLength(2);

    // Breakfast first, with no meat.
    expect(within(meals[0]!).getByText("Breakfast")).toBeInTheDocument();
    expect(within(meals[0]!).getByRole("link", { name: "Overnight oats" })).toHaveAttribute("href", "/recipes/r-oats");
    expect(await within(meals[0]!).findByText("none")).toBeInTheDocument();
    expect(within(meals[0]!).getByText("Serves 4 · 5 min")).toBeInTheDocument();

    // Dinner lists its meats, and links to the recipe and its notes.
    expect(await within(meals[1]!).findByText("chicken thighs, bacon")).toBeInTheDocument();
    expect(within(meals[1]!).getByText("Serves 4 · 45 min")).toBeInTheDocument();
    expect(within(meals[1]!).getByRole("link", { name: "Open recipe" })).toHaveAttribute("href", "/recipes/r-tacos");
    expect(within(meals[1]!).getByRole("link", { name: "Notes" })).toHaveAttribute("href", "/recipes/r-tacos#notes");
  });

  // The range now runs through tomorrow (it used to end today) so the page can
  // preview tomorrow's meals in the same single request.
  it("asks only for the last 30 days through tomorrow", async () => {
    vi.mocked(listPlannedMealsBetween).mockResolvedValue([]);
    renderHome();
    await screen.findByText("Nothing planned for today.");
    expect(listPlannedMealsBetween).toHaveBeenCalledTimes(1);
    expect(listPlannedMealsBetween).toHaveBeenCalledWith(toIsoDate(addDays(today, -30)), TOMORROW);
  });

  it("previews tomorrow's meals with their meat, tags (marinate first) and latest note", async () => {
    vi.mocked(listPlannedMealsBetween).mockResolvedValue([meal("kebabs", TOMORROW, "dinner", "Lamb kebabs")]);
    vi.mocked(listRecipeNotes).mockImplementation(async (recipeId) =>
      recipeId === "r-kebabs"
        ? [
            { id: "n2", body: "Use metal skewers.", createdAt: "2026-11-10T12:00:00Z", updatedAt: "2026-11-10T12:00:00Z" },
            { id: "n1", body: "Too salty.", createdAt: "2026-10-01T12:00:00Z", updatedAt: "2026-10-01T12:00:00Z" },
          ]
        : []
    );
    renderHome();

    expect(await screen.findByText("Nothing planned for today.")).toBeInTheDocument();
    const tomorrowList = screen.getByRole("list", { name: "Tomorrow's meals" });
    const card = within(tomorrowList).getByRole("listitem");
    expect(within(card).getByText("Dinner")).toBeInTheDocument();
    expect(await within(card).findByText("lamb shoulder")).toBeInTheDocument();

    // Marinate tag first, then the recipe's order, up to three, the rest counted.
    const tags = within(card).getAllByText(/./, { selector: ".recipe-tag" }).map((tag) => tag.textContent);
    expect(tags).toEqual(["Marinate overnight", "grill", "summer"]);
    expect(within(card).getByText("+2 more")).toBeInTheDocument();

    // Only the newest note.
    expect(await within(card).findByText("Use metal skewers.")).toBeInTheDocument();
    expect(within(card).getByText(/^Latest note · Nov 10, 2026$/)).toBeInTheDocument();
    expect(within(card).queryByText("Too salty.")).not.toBeInTheDocument();
  });

  it("says when nothing is planned tomorrow, and shows no note or tags when a recipe has none", async () => {
    vi.mocked(listPlannedMealsBetween).mockResolvedValue([meal("soup", TODAY, "dinner", "Tortellini soup")]);
    renderHome();

    expect(await screen.findByText("Nothing planned for tomorrow yet.")).toBeInTheDocument();
    const card = within(screen.getByRole("list", { name: "Today's meals" })).getByRole("listitem");
    expect(await within(card).findByText("italian sausage")).toBeInTheDocument();
    expect(within(card).queryByText(/Latest note/)).not.toBeInTheDocument();
    expect(card.querySelector(".recipe-tag")).toBeNull();
  });

  it("offers to plan a meal when nothing is planned", async () => {
    vi.mocked(listPlannedMealsBetween).mockResolvedValue([]);
    renderHome();

    expect(await screen.findByText("Nothing planned for today.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Plan a meal" })).toHaveAttribute("href", "/meal-plans");
    expect(screen.getByText(/No meals planned in the last 30 days/)).toBeInTheDocument();
  });

  // The sign-in loading modal stays up until this fires (see AppRouter).
  it("reports ready only once the plan, every recipe and the previewed notes have loaded", async () => {
    vi.mocked(listPlannedMealsBetween).mockResolvedValue([
      meal("tacos", TODAY, "dinner", "Chicken tacos"),
      meal("kebabs", TOMORROW, "dinner", "Lamb kebabs"),
      meal("soup", YESTERDAY, "dinner", "Tortellini soup"),
    ]);
    let releaseNotes: () => void = () => {};
    const notesHeld = new Promise<void>((resolve) => (releaseNotes = resolve));
    vi.mocked(listRecipeNotes).mockImplementation(async () => {
      await notesHeld;
      return [];
    });
    const onReady = vi.fn();
    renderWithProviders(
      <MemoryRouter>
        <AppHomePage onReady={onReady} />
      </MemoryRouter>
    );

    // Plan and recipes are in, but notes are still loading.
    expect(await screen.findByText("chicken thighs, bacon")).toBeInTheDocument();
    expect(await screen.findByText("lamb shoulder")).toBeInTheDocument();
    expect(onReady).not.toHaveBeenCalled();

    releaseNotes();
    await waitFor(() => expect(onReady).toHaveBeenCalled());
    // Every meal's recipe was loaded, including the last meal's (for its rating).
    expect(getRecipeById).toHaveBeenCalledWith("r-soup");
    // Notes only for the meals that preview them (today and tomorrow).
    expect(vi.mocked(listRecipeNotes).mock.calls.map(([id]) => id).sort()).toEqual(["r-kebabs", "r-tacos"]);
  });

  it("reports ready when the plan fails to load, so sign-in isn't stuck", async () => {
    vi.mocked(listPlannedMealsBetween).mockRejectedValue(new Error("Failed to load planned meals."));
    const onReady = vi.fn();
    renderWithProviders(
      <MemoryRouter>
        <AppHomePage onReady={onReady} />
      </MemoryRouter>
    );
    await waitFor(() => expect(onReady).toHaveBeenCalled());
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
    expect(screen.getByRole("link", { name: "See all notes" })).toHaveAttribute("href", "/recipes/r-soup#notes");

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
