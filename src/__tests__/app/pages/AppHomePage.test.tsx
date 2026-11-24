import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import AppHomePage from "../../../app/pages/AppHomePage";
import RecipeBackLinks, { type RecipeBackLinksState } from "../../../features/recipes/components/RecipeBackLinks";
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
const IN_THREE_DAYS = toIsoDate(addDays(today, 3));
const shortDate = (date: Date) =>
  new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(date);

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

  // The range runs 30 days ahead (it used to end tomorrow) so the page can find
  // the next day with meals, however far off, in the same single request.
  it("asks only for 30 days back to 30 days ahead", async () => {
    vi.mocked(listPlannedMealsBetween).mockResolvedValue([]);
    renderHome();
    await screen.findByText("Nothing planned for today.");
    expect(listPlannedMealsBetween).toHaveBeenCalledTimes(1);
    expect(listPlannedMealsBetween).toHaveBeenCalledWith(toIsoDate(addDays(today, -30)), toIsoDate(addDays(today, 30)));
  });

  // "Next day's meals" (it was "Tomorrow") is the next day after today that has meals.
  it("shows the next day with meals, a few days off, with its date", async () => {
    vi.mocked(listPlannedMealsBetween).mockResolvedValue([
      meal("oats", IN_THREE_DAYS, "breakfast", "Overnight oats"),
      meal("tacos", IN_THREE_DAYS, "dinner", "Chicken tacos"),
      meal("soup", toIsoDate(addDays(today, 5)), "dinner", "Tortellini soup"),
    ]);
    renderHome();

    const next = await screen.findByRole("list", { name: "Next day's meals" });
    const cards = within(next).getAllByRole("listitem");
    expect(cards.map((card) => within(card).getByRole("heading", { level: 3 }).textContent)).toEqual([
      "Overnight oats",
      "Chicken tacos",
    ]);
    expect(screen.getByText(shortDate(addDays(today, 3)))).toHaveClass("home-card__eyebrow");
    expect(screen.queryByText("Tortellini soup")).not.toBeInTheDocument();
  });

  it("labels the next meals as tomorrow's when they are", async () => {
    vi.mocked(listPlannedMealsBetween).mockResolvedValue([meal("tacos", TOMORROW, "dinner", "Chicken tacos")]);
    renderHome();
    expect(await screen.findByText(`Tomorrow · ${shortDate(addDays(today, 1))}`)).toBeInTheDocument();
  });

  it("previews the next meals with their meat, tags (marinate first) and latest note", async () => {
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
    const nextList = screen.getByRole("list", { name: "Next day's meals" });
    const card = within(nextList).getByRole("listitem");
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

  it("says when nothing is planned ahead, and shows no note or tags when a recipe has none", async () => {
    vi.mocked(listPlannedMealsBetween).mockResolvedValue([meal("soup", TODAY, "dinner", "Tortellini soup")]);
    renderHome();

    expect(await screen.findByText("Nothing planned in the next 30 days.")).toBeInTheDocument();
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
    // Every card shows its recipe's latest note, the last meal's too (it used to
    // be only today's and the next meals').
    expect(vi.mocked(listRecipeNotes).mock.calls.map(([id]) => id).sort()).toEqual(["r-kebabs", "r-soup", "r-tacos"]);
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

  it("opens recipes so their page links back home, not to Recipes", async () => {
    const user = userEvent.setup();
    vi.mocked(listPlannedMealsBetween).mockResolvedValue([
      meal("tacos", TODAY, "dinner", "Chicken tacos"),
      meal("soup", YESTERDAY, "dinner", "Tortellini soup"),
    ]);
    // The recipe page's back links, given the state the home page's link passed.
    function RecipeBackLinksProbe() {
      return <RecipeBackLinks state={useLocation().state as RecipeBackLinksState | null} />;
    }
    const renderHomeWithRecipe = () =>
      renderWithProviders(
        <MemoryRouter>
          <Routes>
            <Route path="/" element={<AppHomePage />} />
            <Route path="/recipes/:recipeId" element={<RecipeBackLinksProbe />} />
          </Routes>
        </MemoryRouter>
      );

    // Today's meal card, by its title.
    const first = renderHomeWithRecipe();
    await user.click(await screen.findByRole("link", { name: "Chicken tacos" }));
    expect(screen.getByRole("link", { name: "Back to Home" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("link", { name: "Back to Recipes" })).not.toBeInTheDocument();
    first.unmount();

    // The last meal card's "Notes" (it was "See all notes": every card's links are the same now).
    renderHomeWithRecipe();
    const lastMeal = await screen.findByRole("list", { name: "Last day's meals" });
    await user.click(within(lastMeal).getByRole("link", { name: "Notes" }));
    expect(screen.getByRole("link", { name: "Back to Home" })).toBeInTheDocument();
  });

  it("builds every section the same way: the day, the heading, then meal cards", async () => {
    vi.mocked(listPlannedMealsBetween).mockResolvedValue([
      meal("tacos", TODAY, "dinner", "Chicken tacos"),
      meal("kebabs", TOMORROW, "dinner", "Lamb kebabs"),
      meal("soup", YESTERDAY, "dinner", "Tortellini soup"),
    ]);
    renderHome();
    await screen.findByRole("list", { name: "Last day's meals" });

    const sections = Array.from(document.querySelectorAll(".home-card"));
    expect(sections.map((section) => section.querySelector(".home-card__title")?.textContent)).toEqual([
      "Today's meals",
      "Next day's meals",
      "Last day's meals",
    ]);
    // One date format for all of them.
    expect(sections.map((section) => section.querySelector(".home-card__eyebrow")?.textContent)).toEqual([
      `Today · ${shortDate(today)}`,
      `Tomorrow · ${shortDate(addDays(today, 1))}`,
      `Yesterday · ${shortDate(addDays(today, -1))}`,
    ]);
    // The same card, with the same links, in each.
    for (const section of sections) {
      const card = within(section as HTMLElement).getByRole("listitem");
      expect(card).toHaveClass("home-meal");
      expect(within(card).getByRole("link", { name: "Open recipe" })).toBeInTheDocument();
      expect(within(card).getByRole("link", { name: "Notes" })).toBeInTheDocument();
    }
    // No "Open planner" button; the nav has the planner.
    expect(screen.queryByRole("link", { name: "Open planner" })).not.toBeInTheDocument();
  });

  // "Last day's meals" (it was "Last meal", just that day's final meal).
  it("shows every meal on the last day with meals, each to rate", async () => {
    vi.mocked(listPlannedMealsBetween).mockResolvedValue([
      meal("soup", YESTERDAY, "dinner", "Tortellini soup"),
      meal("oats", YESTERDAY, "breakfast", "Overnight oats"),
      { ...meal("gone", YESTERDAY, "lunch", "Deleted salad"), recipeId: null },
      meal("tacos", toIsoDate(addDays(today, -4)), "dinner", "Chicken tacos"),
    ]);
    renderHome();

    const last = await screen.findByRole("list", { name: "Last day's meals" });
    const cards = within(last).getAllByRole("listitem");
    expect(cards.map((card) => within(card).getByRole("heading", { level: 3 }).textContent)).toEqual([
      "Overnight oats",
      "Deleted salad",
      "Tortellini soup",
    ]);
    expect(within(cards[0]!).getByRole("radiogroup", { name: "Rate Overnight oats" })).toBeInTheDocument();
    expect(within(cards[2]!).getByRole("radiogroup", { name: "Rate Tortellini soup" })).toBeInTheDocument();
    // A deleted recipe has nothing to rate or open.
    expect(within(cards[1]!).queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(within(cards[1]!).queryByRole("link")).not.toBeInTheDocument();
    // Only the last day's.
    expect(screen.queryByText("Chicken tacos")).not.toBeInTheDocument();
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

    // The last meal is a card like the others: the day above the section's
    // heading (it used to say just "Yesterday's dinner"), the meal type on the
    // card, and the same Open recipe / Notes links.
    const lastMeal = await screen.findByRole("list", { name: "Last day's meals" });
    expect(screen.getByText(`Yesterday · ${shortDate(addDays(today, -1))}`)).toHaveClass("home-card__eyebrow");
    expect(within(lastMeal).getByText("Dinner")).toBeInTheDocument();
    expect(within(lastMeal).getByRole("link", { name: "Notes" })).toHaveAttribute("href", "/recipes/r-soup#notes");
    expect(within(lastMeal).getByRole("link", { name: "Open recipe" })).toHaveAttribute("href", "/recipes/r-soup");
    // It's been eaten, so no cooking details (time, meat), just rating and notes.
    expect(within(lastMeal).queryByText(/Serves/)).not.toBeInTheDocument();
    expect(within(lastMeal).queryByText(/Meat & seafood/)).not.toBeInTheDocument();

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
