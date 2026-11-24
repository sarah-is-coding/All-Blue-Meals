import { fireEvent, render, screen } from "@testing-library/react";
import RecipeFormFields from "../../../../features/recipes/components/RecipeFormFields";
import type { RecipeFormValues } from "../../../../features/recipes/utils/recipeForm";

vi.mock("../../../../features/ingredients/api", () => ({
  searchIngredients: vi.fn().mockResolvedValue([]),
  createIngredient: vi.fn(),
}));
vi.mock("../../../../features/ingredients/queries", () => ({
  useIngredientCategories: () => [],
  // The ingredient field searches and creates through these; not under test here.
  useIngredientSearch: () => ({ suggestions: [], loading: false }),
  useCreateIngredient: () => ({ create: vi.fn(), creating: false }),
}));

const VALUES: RecipeFormValues = {
  title: "Lamb kebabs",
  description: "",
  sourceUrl: "",
  prepMinutes: "20",
  cookMinutes: "15",
  servings: "4",
  tags: "grill",
  instructions: "1. Marinate.\n2. Grill.",
  ingredients: [
    {
      id: "row-1",
      ingredientId: "ing-1",
      ingredientName: "lamb shoulder",
      quantity: "2",
      unit: "lb",
      notes: "",
      category: null,
      substituteFor: null,
    },
  ],
};

const renderForm = () => {
  const handlers = {
    onFieldChange: vi.fn(),
    onIngredientChange: vi.fn(),
    onIngredientSelect: vi.fn(),
    onAddIngredient: vi.fn(),
    onAddSubstitute: vi.fn(),
    onRemoveIngredient: vi.fn(),
  };
  render(<RecipeFormFields values={VALUES} readOnly={false} {...handlers} />);
  return handlers;
};

const sectionTitles = () =>
  Array.from(document.querySelectorAll(".recipe-form__section-title")).map((title) => title.textContent);

describe("RecipeFormFields", () => {
  // Ingredients come before Instructions, as on the recipe page and in most
  // recipes (Instructions used to come first).
  it("orders the sections Basics, Details, Ingredients, Instructions", () => {
    renderForm();
    expect(sectionTitles()).toEqual(["Basics", "Details", "Ingredients", "Instructions"]);
  });

  it("puts Prep, Cook and Servings in one row", () => {
    renderForm();
    const row = document.querySelector(".recipe-form__numbers")!;
    for (const label of ["Prep (min)", "Cook (min)", "Servings"]) {
      expect(row).toContainElement(screen.getByLabelText(label));
    }
    expect(screen.getByLabelText("Prep (min)")).toHaveValue(20);
  });

  it("has a growing Instructions box with an accessible name", () => {
    const { onFieldChange } = renderForm();
    const instructions = screen.getByLabelText("Instructions");
    expect(instructions).toHaveClass("recipe-form__instructions");
    expect(instructions).toHaveValue("1. Marinate.\n2. Grill.");
    fireEvent.change(instructions, { target: { value: "1. Grill." } });
    expect(onFieldChange).toHaveBeenCalledWith("instructions", "1. Grill.");
  });

  it("shows the ingredients as compact rows under column headings", () => {
    const { onAddIngredient } = renderForm();
    const headings = document.querySelector(".recipe-ingredients__columns")!;
    expect(headings).toHaveAttribute("aria-hidden", "true");
    expect(headings).toHaveTextContent("IngredientQtyUnitNotes");
    expect(screen.getByLabelText("Quantity of lamb shoulder")).toHaveValue("2");

    fireEvent.click(screen.getAllByRole("button", { name: "+ Add ingredient" })[0]!);
    expect(onAddIngredient).toHaveBeenCalled();
  });
});
