import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../../utils/renderWithProviders";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import RecipeCreatePage from "../../../../features/recipes/pages/RecipeCreatePage";

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
  createRecipe: vi.fn(),
}));

vi.mock("../../../../features/ingredients/api", () => ({
  createIngredient: vi.fn().mockResolvedValue({
    id: "ingredient-1",
    name: "ground chicken",
    category: "meat_seafood",
    defaultUnit: null,
  }),
  searchIngredients: vi.fn().mockResolvedValue([]),
  findIngredientMatches: vi.fn().mockResolvedValue(new Map()),
}));

import { createRecipe } from "../../../../features/recipes/api";
import { findIngredientMatches, searchIngredients } from "../../../../features/ingredients/api";

const mockCreateRecipe = vi.mocked(createRecipe);

const renderPage = (state?: unknown) =>
  renderWithProviders(
    <MemoryRouter initialEntries={[{ pathname: "/recipes/new", state }]}>
      <Routes>
        <Route path="/recipes/new" element={<RecipeCreatePage />} />
      </Routes>
    </MemoryRouter>
  );

describe("RecipeCreatePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateRecipe.mockResolvedValue("recipe-1");
  });

  it("shows a sticky save button and submits the create form", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/^title$/i), "Chicken Caesar Taco Salad");

    const saveButtons = screen.getAllByRole("button", { name: "Save Recipe" });
    expect(saveButtons).toHaveLength(2);

    await user.click(saveButtons[1]);

    await waitFor(() => {
      expect(mockCreateRecipe).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Chicken Caesar Taco Salad",
        })
      );
    });
    expect(navigate).toHaveBeenCalledWith("/recipes/recipe-1");
  });

  // Step 4 of docs/ingredient-normalization.md: the full substitute journey.
  it("adds an ingredient, adds a substitute for it, and saves them linked", async () => {
    const user = userEvent.setup();
    const match = (id: string, name: string) => ({
      id, name, category: "baking" as const, defaultUnit: null, matchedAlias: null,
    });
    vi.mocked(searchIngredients).mockImplementation(async (term) =>
      term.startsWith("oli") ? [match("ing-olive", "olive oil")] : [match("ing-avo", "avocado oil")]
    );
    renderPage();

    await user.type(screen.getByLabelText(/^title$/i), "Roast Veg");

    // 1. Pick the main ingredient.
    await user.type(screen.getAllByRole("combobox")[0], "oli");
    await waitFor(() => screen.getByText("olive oil"), { timeout: 1500 });
    await user.click(screen.getByText("olive oil"));

    // 2. Add a substitute under it.
    await user.click(screen.getByRole("button", { name: "+ Add substitute" }));
    expect(screen.getByRole("article", { name: "Substitute ingredient" })).toBeInTheDocument();
    expect(screen.getByText("or")).toBeInTheDocument();

    // 3. Pick the substitute (the second combobox).
    await user.type(screen.getAllByRole("combobox")[1], "avo");
    await waitFor(() => screen.getByText("avocado oil"), { timeout: 1500 });
    await user.click(screen.getByText("avocado oil"));

    // 4. Save: the substitute points at the main row.
    await user.click(screen.getAllByRole("button", { name: "Save Recipe" })[0]);
    await waitFor(() => expect(mockCreateRecipe).toHaveBeenCalled());
    const [mainRow, substituteRow] = mockCreateRecipe.mock.calls[0][0].ingredients;
    expect(mainRow).toMatchObject({ ingredientId: "ing-olive", ingredientName: "olive oil", substituteFor: null });
    expect(substituteRow).toMatchObject({
      ingredientId: "ing-avo",
      ingredientName: "avocado oil",
      substituteFor: mainRow!.clientId,
    });
  });

  it("removes a main ingredient's substitutes when the main ingredient is removed", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getAllByRole("button", { name: "+ Add ingredient" })[0]);
    await user.click(screen.getAllByRole("button", { name: "+ Add substitute" })[0]);
    expect(screen.getAllByRole("combobox")).toHaveLength(3);

    // The first Remove belongs to the first main row.
    await user.click(screen.getAllByRole("button", { name: "Remove" })[0]);
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
    expect(screen.queryByRole("article", { name: "Substitute ingredient" })).not.toBeInTheDocument();
  });

  // Step 5: an imported draft labels each ingredient as new or matched.
  it("labels imported ingredients as new or matching an existing ingredient", async () => {
    const greenOnion = { id: "i-1", name: "green onion", category: "produce" as const, defaultUnit: null };
    const garlic = { id: "i-2", name: "garlic", category: "produce" as const, defaultUnit: null };
    vi.mocked(findIngredientMatches).mockResolvedValue(
      new Map([["greenonion", greenOnion], ["garlic", garlic]])
    );
    const ing = (ingredientName: string, canonicalName?: string) => ({
      ingredientName, canonicalName, quantity: "1", unit: "", notes: "", category: "produce" as const,
    });

    renderPage({
      importedRecipe: {
        title: "Stir fry", description: "", sourceUrl: null, prepMinutes: null, cookMinutes: null,
        servings: null, tags: [], instructions: "", confidence: "high", warnings: [],
        ingredients: [ing("scallions", "green onion"), ing("garlic"), ing("sumac")],
      },
    });

    // scallions → its canonical name is in the catalog; garlic matches exactly
    // (nothing to say); sumac is new.
    expect(await screen.findByText("Matches green onion")).toBeInTheDocument();
    expect(screen.getAllByText("New ingredient")).toHaveLength(1);
    expect(screen.queryByText("Matches garlic")).not.toBeInTheDocument();
  });

  it("doesn't label anything on a blank recipe", () => {
    renderPage();
    expect(screen.queryByText("New ingredient")).not.toBeInTheDocument();
    expect(findIngredientMatches).not.toHaveBeenCalled();
  });
});
