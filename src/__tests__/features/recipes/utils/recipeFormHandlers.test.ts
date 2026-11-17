import { createEmptyIngredient, type RecipeFormValues } from "../../../../features/recipes/utils/recipeForm";
import { createRecipeFormHandlers } from "../../../../features/recipes/utils/recipeFormHandlers";

const formWith = (ingredients = [createEmptyIngredient()]): RecipeFormValues => ({
  title: "", description: "", sourceUrl: "", prepMinutes: "", cookMinutes: "",
  servings: "", tags: "", instructions: "", ingredients,
});

// Applies each change to a local value, like the pages' setState does.
const setup = (initial: RecipeFormValues) => {
  let values = initial;
  const handlers = createRecipeFormHandlers((change) => {
    values = change(values);
  });
  return { handlers, get: () => values };
};

describe("createRecipeFormHandlers", () => {
  it("changes a recipe field", () => {
    const { handlers, get } = setup(formWith());
    handlers.onFieldChange("title", "Soup");
    expect(get().title).toBe("Soup");
  });

  it("changes one ingredient's text field", () => {
    const [a, b] = [createEmptyIngredient(), createEmptyIngredient()];
    const { handlers, get } = setup(formWith([a, b]));
    handlers.onIngredientChange(b.id, "quantity", "2");
    expect(get().ingredients.map((row) => row.quantity)).toEqual(["", "2"]);
  });

  it("sets the catalog id and name when an ingredient is picked", () => {
    const row = createEmptyIngredient();
    const { handlers, get } = setup(formWith([row]));
    handlers.onIngredientSelect(row.id, "ing-1", "onion");
    expect(get().ingredients[0]).toMatchObject({ ingredientId: "ing-1", ingredientName: "onion" });
  });

  it("adds an ingredient, adds a substitute, and removes a main row with its substitute", () => {
    const row = createEmptyIngredient();
    const { handlers, get } = setup(formWith([row]));

    handlers.onAddIngredient();
    expect(get().ingredients).toHaveLength(2);

    handlers.onAddSubstitute(row.id);
    expect(get().ingredients[1]!.substituteFor).toBe(row.id);

    handlers.onRemoveIngredient(row.id);
    expect(get().ingredients).toHaveLength(1);
    expect(get().ingredients[0]!.substituteFor).toBeNull();
  });
});
