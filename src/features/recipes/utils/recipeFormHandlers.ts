// The edit handlers RecipeFormFields needs, shared by the create and detail
// pages. Each page supplies one `update` function that applies a change to
// its form values (the detail page's values can be null while loading).

import {
  addSubstituteRow,
  createEmptyIngredient,
  removeIngredientRow,
  type RecipeFieldName,
  type RecipeFormValues,
  type RecipeIngredientFieldName,
} from "./recipeForm";

export type RecipeFormUpdate = (change: (values: RecipeFormValues) => RecipeFormValues) => void;

export type RecipeFormHandlers = {
  onFieldChange: (field: RecipeFieldName, value: string) => void;
  onIngredientChange: (rowId: string, field: RecipeIngredientFieldName, value: string) => void;
  onIngredientSelect: (rowId: string, ingredientId: string, name: string) => void;
  onAddIngredient: () => void;
  onAddSubstitute: (mainRowId: string) => void;
  onRemoveIngredient: (rowId: string) => void;
};

export const createRecipeFormHandlers = (update: RecipeFormUpdate): RecipeFormHandlers => {
  const updateIngredients = (
    change: (ingredients: RecipeFormValues["ingredients"]) => RecipeFormValues["ingredients"]
  ) => update((values) => ({ ...values, ingredients: change(values.ingredients) }));

  return {
    onFieldChange: (field, value) => update((values) => ({ ...values, [field]: value })),
    onIngredientChange: (rowId, field, value) =>
      updateIngredients((ingredients) =>
        ingredients.map((row) => (row.id === rowId ? { ...row, [field]: value } : row))
      ),
    onIngredientSelect: (rowId, ingredientId, name) =>
      updateIngredients((ingredients) =>
        ingredients.map((row) =>
          row.id === rowId ? { ...row, ingredientId, ingredientName: name } : row
        )
      ),
    onAddIngredient: () =>
      updateIngredients((ingredients) => [...ingredients, createEmptyIngredient()]),
    onAddSubstitute: (mainRowId) =>
      updateIngredients((ingredients) => addSubstituteRow(ingredients, mainRowId)),
    onRemoveIngredient: (rowId) =>
      updateIngredients((ingredients) => removeIngredientRow(ingredients, rowId)),
  };
};
