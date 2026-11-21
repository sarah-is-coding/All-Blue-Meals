import { screen, waitFor, within } from "@testing-library/react";
import { renderWithProviders } from "../../../utils/renderWithProviders";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import RecipesPage from "../../../../features/recipes/pages/RecipesPage";
import {
  createDefaultRecipeListFilters,
  saveRecipeListViewState,
} from "../../../../features/recipes/utils/recipeListViewState";

vi.mock("../../../../features/recipes/api", () => ({
  listRecipes: vi.fn(),
  listRecipeTags: vi.fn(),
}));

import { listRecipeTags, listRecipes } from "../../../../features/recipes/api";

const mockListRecipes = vi.mocked(listRecipes);

const recipes = [
  {
    id: "recipe-1",
    title: "Chicken Caesar Taco Salad",
    description: "Weeknight favorite.",
    prepMinutes: 10,
    cookMinutes: 15,
    tags: [],
    hasSource: false,
    rating: 4,
    createdAt: "2026-05-25T00:00:00Z",
  },
  {
    id: "recipe-2",
    title: "Unrated Soup",
    description: null,
    prepMinutes: null,
    cookMinutes: null,
    tags: [],
    hasSource: false,
    rating: null,
    createdAt: "2026-05-24T00:00:00Z",
  },
];

const renderPage = () =>
  renderWithProviders(
    <MemoryRouter initialEntries={["/recipes"]}>
      <RecipesPage />
    </MemoryRouter>
  );

function RecipeDetailLocationProbe() {
  const location = useLocation();
  return <p>state: {JSON.stringify(location.state)}</p>;
}

const renderPageWithMealSlot = () =>
  renderWithProviders(
    <MemoryRouter
      initialEntries={[
        {
          pathname: "/recipes",
          state: { mealSlot: { date: "2026-01-05", mealType: "dinner" } },
        },
      ]}
    >
      <Routes>
        <Route path="/recipes" element={<RecipesPage />} />
        <Route path="/recipes/:recipeId" element={<RecipeDetailLocationProbe />} />
      </Routes>
    </MemoryRouter>
  );

describe("RecipesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    mockListRecipes.mockResolvedValue({ recipes, totalCount: recipes.length });
  });

  it("renders recipe cards and shows the rating only for rated recipes", async () => {
    renderPage();

    await screen.findByText("Chicken Caesar Taco Salad");
    expect(screen.getByText("Unrated Soup")).toBeInTheDocument();

    expect(
      screen.getByRole("img", { name: "Rated 4 out of 5 stars" })
    ).toBeInTheDocument();
  });

  it("shows a banner and forwards the meal slot when arriving from a meal slot search link", async () => {
    const expectedDateLabel = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(new Date(2026, 0, 5));

    const user = userEvent.setup();
    renderPageWithMealSlot();

    await screen.findByText("Chicken Caesar Taco Salad");
    expect(screen.getByText(`${expectedDateLabel} · Dinner`)).toBeInTheDocument();

    await user.click(screen.getByText("Chicken Caesar Taco Salad"));

    expect(
      await screen.findByText(
        `state: ${JSON.stringify({
          from: "meal-planner",
          mealSlot: { date: "2026-01-05", mealType: "dinner" },
        })}`
      )
    ).toBeInTheDocument();
  });

  it("clears the meal slot banner without leaving the search page when Cancel is clicked", async () => {
    const user = userEvent.setup();
    renderPageWithMealSlot();

    await screen.findByText("Chicken Caesar Taco Salad");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText("Picking a recipe for", { exact: false })).not.toBeInTheDocument();
    expect(screen.getByText("Chicken Caesar Taco Salad")).toBeInTheDocument();
  });

  // Searching runs a moment after typing stops; the Search button (or Enter)
  // runs it straight away, which makes how to search clearer.
  it("searches right away with the Search button", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Chicken Caesar Taco Salad");

    expect(screen.getByRole("search")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Search recipes"), "tacos");
    await user.click(screen.getByRole("button", { name: "Search" }));

    // Without waiting for the pause after typing.
    expect(mockListRecipes).toHaveBeenLastCalledWith("tacos", expect.anything(), expect.objectContaining({ page: 1 }));
  });

  it("searches with Enter too", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Chicken Caesar Taco Salad");

    await user.type(screen.getByLabelText("Search recipes"), "salad{Enter}");

    await waitFor(() =>
      expect(mockListRecipes).toHaveBeenLastCalledWith("salad", expect.anything(), expect.objectContaining({ page: 1 }))
    );
  });

  it("re-queries with the selected minimum rating filter", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Chicken Caesar Taco Salad");
    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.selectOptions(screen.getByLabelText("Minimum rating"), "4");

    await waitFor(() => {
      expect(mockListRecipes).toHaveBeenLastCalledWith(
        "",
        expect.objectContaining({ minRating: 4 }),
        expect.objectContaining({ page: 1 })
      );
    });
  });

  it("keeps a remembered page while it loads, instead of jumping back to page 1", async () => {
    saveRecipeListViewState({
      searchInput: "",
      filters: createDefaultRecipeListFilters(),
      currentPage: 2,
      view: "list",
      openTag: null,
    });
    mockListRecipes.mockResolvedValue({ recipes, totalCount: 30 });
    renderPage();

    await screen.findByText("Chicken Caesar Taco Salad");
    expect(mockListRecipes).toHaveBeenCalledWith("", expect.anything(), expect.objectContaining({ page: 2 }));
    expect(mockListRecipes).not.toHaveBeenCalledWith("", expect.anything(), expect.objectContaining({ page: 1 }));
  });

  it("moves to the last page when there are fewer results than the remembered page", async () => {
    saveRecipeListViewState({
      searchInput: "",
      filters: createDefaultRecipeListFilters(),
      currentPage: 3,
      view: "list",
      openTag: null,
    });
    mockListRecipes.mockResolvedValue({ recipes, totalCount: recipes.length });
    renderPage();

    await waitFor(() =>
      expect(mockListRecipes).toHaveBeenLastCalledWith("", expect.anything(), expect.objectContaining({ page: 1 }))
    );
  });

  // A second way to browse: folders by tag, picked from the View menu (the
  // list stays the default).
  describe("tag folders view", () => {
    const switchToFolders = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(screen.getByRole("button", { name: /View: List/ }));
      await user.click(screen.getByRole("menuitemradio", { name: "Tag folders" }));
    };

    beforeEach(() => {
      vi.mocked(listRecipeTags).mockResolvedValue([
        ["Italian", "dinner"],
        ["italian", "Dessert"],
        ["dinner"],
      ]);
    });

    it("shows the list by default, with the view menu offering other views", async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText("Chicken Caesar Taco Salad");

      expect(listRecipeTags).not.toHaveBeenCalled();
      // Phones hide the visible "View:" prefix to fit the toolbar on one line;
      // the button's name keeps it.
      const viewButton = screen.getByRole("button", { name: "View: List" });
      expect(viewButton.querySelector(".recipe-view-menu__prefix")).toHaveTextContent("View:");
      await user.click(viewButton);
      expect(screen.getByRole("menuitemradio", { name: "List" })).toHaveAttribute("aria-checked", "true");
      expect(screen.getByRole("menuitemradio", { name: "Tag folders" })).toHaveAttribute("aria-checked", "false");
    });

    // On phones both menus open full width under the toolbar, so only one
    // can be open at a time.
    it("closes the other toolbar menu when one opens", async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText("Chicken Caesar Taco Salad");

      await user.click(screen.getByRole("button", { name: "View: List" }));
      expect(screen.getByRole("menu", { name: "Recipe view" })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Add Recipe" }));
      expect(screen.queryByRole("menu", { name: "Recipe view" })).not.toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: "Import Recipe" })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "View: List" }));
      expect(screen.queryByRole("menuitem", { name: "Import Recipe" })).not.toBeInTheDocument();
      expect(screen.getByRole("menu", { name: "Recipe view" })).toBeInTheDocument();
    });

    it("shows a folder per tag, ignoring case, with recipe counts", async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText("Chicken Caesar Taco Salad");
      await switchToFolders(user);

      const folders = await screen.findByRole("list", { name: "Tag folders" });
      expect(within(folders).getAllByRole("button").map((button) => button.textContent)).toEqual([
        "📁Dessert1 recipe",
        "📁dinner2 recipes",
        "📁Italian2 recipes",
      ]);
      expect(screen.getByRole("button", { name: /View: Tag folders/ })).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Search tags...")).toBeInTheDocument();
    });

    it("opens a folder to show its recipes, and goes back to all tags", async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText("Chicken Caesar Taco Salad");
      await switchToFolders(user);

      await user.click(await screen.findByRole("button", { name: /Italian/ }));

      expect(screen.getByRole("heading", { name: "Italian" })).toBeInTheDocument();
      await waitFor(() =>
        expect(mockListRecipes).toHaveBeenLastCalledWith(
          "",
          expect.objectContaining({ tag: "italian" }),
          expect.objectContaining({ page: 1 })
        )
      );
      expect(await screen.findByText("Chicken Caesar Taco Salad")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "← All tags" }));
      expect(await screen.findByRole("list", { name: "Tag folders" })).toBeInTheDocument();
    });

    it("narrows the folders with the search box", async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText("Chicken Caesar Taco Salad");
      await switchToFolders(user);
      await screen.findByRole("list", { name: "Tag folders" });

      await user.type(screen.getByLabelText("Search tags"), "din");
      const folders = screen.getByRole("list", { name: "Tag folders" });
      expect(within(folders).getAllByRole("button")).toHaveLength(1);

      await user.clear(screen.getByLabelText("Search tags"));
      await user.type(screen.getByLabelText("Search tags"), "zzz");
      expect(screen.getByText("No tags match")).toBeInTheDocument();
    });

    it("comes back to the open folder after visiting a recipe", async () => {
      saveRecipeListViewState({
        searchInput: "",
        filters: createDefaultRecipeListFilters(),
        currentPage: 1,
        view: "tags",
        openTag: "italian",
      });
      renderPage();

      expect(await screen.findByRole("heading", { name: "Italian" })).toBeInTheDocument();
      await waitFor(() =>
        expect(mockListRecipes).toHaveBeenCalledWith("", expect.objectContaining({ tag: "italian" }), expect.anything())
      );
    });
  });
});
