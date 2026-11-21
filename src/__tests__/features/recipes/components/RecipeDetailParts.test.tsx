import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import IngredientCategoryPicker from "../../../../features/recipes/components/IngredientCategoryPicker";
import RecipeBackLinks from "../../../../features/recipes/components/RecipeBackLinks";
import RecipeDeleteControls from "../../../../features/recipes/components/RecipeDeleteControls";
import RecipeScaleTools from "../../../../features/recipes/components/RecipeScaleTools";
import { FALLBACK_CATEGORIES } from "../../../../features/ingredients/categories/codes";

// Pieces split out of RecipeDetailPage and IngredientNameCombobox to keep
// those files under 300 lines; the pages' own tests cover them in place too.

describe("RecipeDeleteControls", () => {
  it("asks for confirmation, then deletes", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<RecipeDeleteControls onDelete={onDelete} onError={vi.fn()} otherActions={<button>Edit</button>} />);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText("Delete this recipe?")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("goes back without deleting on Cancel", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<RecipeDeleteControls onDelete={onDelete} onError={vi.fn()} otherActions={<button>Edit</button>} />);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("reports a failed delete and lets the user try again", async () => {
    const user = userEvent.setup();
    const onError = vi.fn();
    render(<RecipeDeleteControls onDelete={vi.fn().mockRejectedValue(new Error("nope"))} onError={onError} />);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));
    await waitFor(() => expect(onError).toHaveBeenLastCalledWith("nope"));
    expect(screen.getByRole("button", { name: "Confirm delete" })).toBeEnabled();
  });
});

describe("RecipeBackLinks", () => {
  const renderLinks = (state: Parameters<typeof RecipeBackLinks>[0]["state"]) =>
    render(<MemoryRouter><RecipeBackLinks state={state} /></MemoryRouter>);

  it("links back to recipes by default", () => {
    renderLinks(null);
    expect(screen.getByRole("link", { name: "Back to Recipes" })).toHaveAttribute("href", "/recipes");
    expect(screen.queryByRole("link", { name: "Back to Meal Planner" })).not.toBeInTheDocument();
  });

  it("links only to the planner for a meal opened from it", () => {
    renderLinks({ from: "meal-planner" });
    expect(screen.getByRole("link", { name: "Back to Meal Planner" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Back to Recipes" })).not.toBeInTheDocument();
  });

  it("offers both when picking a recipe for a planner slot", () => {
    renderLinks({ from: "meal-planner", mealSlot: { date: "2026-11-17", mealType: "dinner" } });
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });
});

describe("RecipeScaleTools", () => {
  it("offers to scale when servings changed", async () => {
    const user = userEvent.setup();
    const onScale = vi.fn();
    render(<RecipeScaleTools baseServings={2} targetServings={4} canScale disabled={false} onScale={onScale} />);
    expect(screen.getByText(/based on 2 servings/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Scale ingredients to 4 servings" }));
    expect(onScale).toHaveBeenCalled();
  });

  it("is disabled until servings change", () => {
    render(<RecipeScaleTools baseServings={null} targetServings={null} canScale={false} disabled={false} onScale={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Adjust servings to enable scaling" })).toBeDisabled();
    expect(screen.getByText(/based on unknown servings/)).toBeInTheDocument();
  });
});

describe("IngredientCategoryPicker", () => {
  it("shows every category and picks one", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(
      <IngredientCategoryPicker
        name="sumac"
        categories={FALLBACK_CATEGORIES}
        activeIndex={-1}
        creating={false}
        onActiveIndexChange={vi.fn()}
        onPick={onPick}
        onBack={vi.fn()}
      />
    );
    expect(screen.getByText('Pick a category for "sumac"')).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(FALLBACK_CATEGORIES.length);
    // Pills show each category's label; picking one returns its code.
    await user.click(screen.getByRole("option", { name: "Baking" }));
    expect(onPick).toHaveBeenCalledWith("baking");
  });

  it("shows progress on the active pill while creating, and goes back", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(
      <IngredientCategoryPicker
        name="sumac"
        categories={FALLBACK_CATEGORIES}
        activeIndex={0}
        creating
        onActiveIndexChange={vi.fn()}
        onPick={vi.fn()}
        onBack={onBack}
      />
    );
    expect(screen.getByRole("option", { name: "Adding…" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "← back" }));
    expect(onBack).toHaveBeenCalled();
  });
});
