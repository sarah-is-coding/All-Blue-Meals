import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RecipeIngredientList from "../../../../features/recipes/components/RecipeIngredientList";
import type { RecipeFormIngredient } from "../../../../features/recipes/utils/recipeForm";

const row = (id: string, overrides: Partial<RecipeFormIngredient> = {}): RecipeFormIngredient => ({
  id,
  ingredientId: `i-${id}`,
  ingredientName: id,
  quantity: "",
  unit: "",
  notes: "",
  category: null,
  substituteFor: null,
  ...overrides,
});

const INGREDIENTS = [
  row("chicken thighs", { quantity: "2", unit: "lb", notes: "boneless" }),
  row("olive oil", { quantity: "2", unit: "tbsp" }),
  row("avocado oil", { quantity: "2", unit: "tbsp", substituteFor: "olive oil" }),
  row("salt", { notes: "to taste" }),
];

const rows = () => within(screen.getByRole("list")).getAllByRole("button");

const renderList = (props: Partial<Parameters<typeof RecipeIngredientList>[0]> = {}) =>
  render(<RecipeIngredientList ingredients={INGREDIENTS} baseServings={4} viewServings={4} {...props} />);

describe("RecipeIngredientList", () => {
  it("shows each ingredient on its own row, the amount in bold", () => {
    renderList();

    expect(rows()).toHaveLength(3); // the substitute is shown on its main row
    expect(rows()[0]).toHaveTextContent("2 lb chicken thighs");
    expect(within(rows()[0]!).getByText("2 lb").tagName).toBe("STRONG");
    expect(within(rows()[0]!).getByText("boneless")).toBeInTheDocument();
    // No amount: just the name, with its note.
    expect(rows()[2]).toHaveTextContent("salt");
    expect(within(rows()[2]!).getByText("to taste")).toBeInTheDocument();
  });

  it("shows substitutes as an 'or' line on their main ingredient", () => {
    renderList();
    expect(within(rows()[1]!).getByText((_, element) => element?.textContent === "or 2 tbsp avocado oil")).toHaveClass(
      "recipe-ingredient-list__substitute"
    );
  });

  it("scales amounts to the servings being viewed", () => {
    renderList({ viewServings: 8 });
    expect(rows()[0]).toHaveTextContent("4 lb chicken thighs");
    expect(rows()[1]).toHaveTextContent("or 4 tbsp avocado oil");
  });

  it("walks gathering ingredients: tick, see progress, untick, reset", async () => {
    const user = userEvent.setup();
    renderList();

    await user.click(rows()[0]!);
    await user.click(rows()[2]!);
    expect(rows()[0]).toHaveAttribute("aria-pressed", "true");
    expect(rows()[0]).toHaveClass("recipe-ingredient-list__item--ticked");
    expect(screen.getByText("2 of 3 ready")).toBeInTheDocument();

    await user.click(rows()[2]!);
    expect(rows()[2]).toHaveAttribute("aria-pressed", "false");

    await user.click(screen.getByRole("button", { name: "Reset ingredients" }));
    for (const item of rows()) expect(item).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText(/ready$/)).not.toBeInTheDocument();
  });

  it("keeps ticks when servings change, and clears them when the ingredients change", async () => {
    const user = userEvent.setup();
    const { rerender } = renderList();
    await user.click(rows()[0]!);

    rerender(<RecipeIngredientList ingredients={INGREDIENTS} baseServings={4} viewServings={6} />);
    expect(rows()[0]).toHaveAttribute("aria-pressed", "true");

    rerender(<RecipeIngredientList ingredients={[row("rice", { quantity: "1", unit: "cup" })]} baseServings={4} viewServings={6} />);
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveAttribute("aria-pressed", "false");
  });

  it("names a row with no name or amount, and says when there are no ingredients", () => {
    const { unmount } = render(
      <RecipeIngredientList ingredients={[row("blank", { ingredientName: "", notes: "see note" })]} baseServings={null} viewServings={null} />
    );
    expect(rows()[0]).toHaveTextContent("Unnamed ingredient");
    unmount();

    render(<RecipeIngredientList ingredients={[]} baseServings={4} viewServings={4} />);
    expect(screen.getByText("No ingredients added yet.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
