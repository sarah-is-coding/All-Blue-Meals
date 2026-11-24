import { fireEvent, render, screen } from "@testing-library/react";
import RecipeIngredientCard from "../../../../features/recipes/components/RecipeIngredientCard";
import type { RecipeFormIngredient } from "../../../../features/recipes/utils/recipeForm";

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

const ingredient = (overrides: Partial<RecipeFormIngredient> = {}): RecipeFormIngredient => ({
  id: "row-1",
  ingredientId: "ing-1",
  ingredientName: "chicken thighs",
  quantity: "2",
  unit: "lb",
  notes: "boneless",
  category: null,
  substituteFor: null,
  ...overrides,
});

const renderCard = (props: Partial<Parameters<typeof RecipeIngredientCard>[0]> = {}) => {
  const handlers = {
    onIngredientChange: vi.fn(),
    onIngredientSelect: vi.fn(),
    onRemove: vi.fn(),
    onAddSubstitute: vi.fn(),
  };
  render(
    <RecipeIngredientCard ingredient={ingredient()} readOnly={false} isSubstitute={false} canRemove {...handlers} {...props} />
  );
  return handlers;
};

describe("RecipeIngredientCard (compact row)", () => {
  it("names every field for its ingredient, with placeholders instead of visible labels", () => {
    renderCard();
    expect(screen.getByRole("combobox", { name: "Ingredient" })).toHaveValue("chicken thighs");
    expect(screen.getByLabelText("Quantity of chicken thighs")).toHaveValue("2");
    expect(screen.getByLabelText("Unit of chicken thighs")).toHaveValue("lb");
    expect(screen.getByLabelText("Notes for chicken thighs")).toHaveValue("boneless");
    expect(screen.getByPlaceholderText("Qty")).toBeInTheDocument();
    expect(screen.queryByText("Quantity")).not.toBeInTheDocument();
  });

  it("reports edits to quantity, unit and notes", () => {
    const { onIngredientChange } = renderCard();
    fireEvent.change(screen.getByLabelText("Quantity of chicken thighs"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Unit of chicken thighs"), { target: { value: "kg" } });
    fireEvent.change(screen.getByLabelText("Notes for chicken thighs"), { target: { value: "skin-on" } });
    expect(onIngredientChange.mock.calls).toEqual([
      ["row-1", "quantity", "3"],
      ["row-1", "unit", "kg"],
      ["row-1", "notes", "skin-on"],
    ]);
  });

  it("adds a substitute and removes the row with its small buttons", () => {
    const { onAddSubstitute, onRemove } = renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Add substitute for chicken thighs" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove chicken thighs" }));
    expect(onAddSubstitute).toHaveBeenCalledWith("row-1");
    expect(onRemove).toHaveBeenCalledWith("row-1");
  });

  it("shows a substitute with its 'or' label and no substitute-of-a-substitute button", () => {
    renderCard({ isSubstitute: true, onAddSubstitute: undefined, ingredient: ingredient({ ingredientName: "turkey" }) });
    expect(screen.getByRole("article", { name: "Substitute ingredient" })).toBeInTheDocument();
    expect(screen.getByText("or")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Substitute" })).toHaveValue("turkey");
    expect(screen.queryByRole("button", { name: /add substitute/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove turkey" })).toBeInTheDocument();
  });

  it("hides Remove when it's the only ingredient", () => {
    renderCard({ canRemove: false });
    expect(screen.queryByRole("button", { name: /remove/i })).not.toBeInTheDocument();
  });

  it("is read-only with no buttons", () => {
    renderCard({ readOnly: true });
    expect(screen.getByLabelText("Quantity of chicken thighs")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Ingredient")).toHaveAttribute("readonly");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("names an empty row's fields and buttons without an ingredient name", () => {
    renderCard({ ingredient: ingredient({ ingredientName: "", quantity: "", unit: "", notes: "" }) });
    expect(screen.getByLabelText("Quantity")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add substitute for this ingredient" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove ingredient" })).toBeInTheDocument();
  });

  it("labels imported rows as new or matched", () => {
    renderCard({ matchStatus: { kind: "matched", name: "chicken thigh" } });
    expect(screen.getByText("Matches chicken thigh")).toBeInTheDocument();
  });
});
