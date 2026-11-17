import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import RecipeFormFields from "../components/RecipeFormFields";
import { useRecipeActions } from "../queries";
import type { ImportedRecipe } from "../types";
import {
  createEmptyRecipeFormValues,
  mapRecipeFormValuesToInput,
  type RecipeFormValues,
} from "../utils/recipeForm";
import { createRecipeFormHandlers } from "../utils/recipeFormHandlers";
import { mapImportedRecipeToFormValues } from "../utils/recipeImport";

type RecipeCreateLocationState = {
  importedRecipe?: ImportedRecipe;
  prefillTitle?: string;
};

export default function RecipeCreatePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { create: createRecipe } = useRecipeActions();
  const locationState = (location.state ?? null) as RecipeCreateLocationState | null;
  const [values, setValues] = useState<RecipeFormValues>(() => {
    if (locationState?.importedRecipe) {
      return mapImportedRecipeToFormValues(locationState.importedRecipe);
    }

    const initialValues = createEmptyRecipeFormValues();
    const prefillTitle = locationState?.prefillTitle?.trim() ?? "";
    if (!prefillTitle) {
      return initialValues;
    }

    return {
      ...initialValues,
      title: prefillTitle,
    };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formHandlers = createRecipeFormHandlers((change) => setValues(change));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const recipeId = await createRecipe(mapRecipeFormValuesToInput(values));
      navigate(`/app/recipes/${recipeId}`);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Failed to create recipe."
      );
      setSaving(false);
    }
  };

  return (
    <section className="workspace-route recipe-route recipe-route--sticky-actions">
      <article className="workspace-card">
        <div className="recipe-page-header">
          <h1>Add Recipe</h1>
          <Link className="btn btn--ghost" to="/app/recipes">
            Back to Recipes
          </Link>
        </div>
        <p>Create a text-first recipe that stays lightweight and easy to edit.</p>
        {error ? <p className="error">{error}</p> : null}
      </article>

      <form
        id="recipe-create-form"
        className="workspace-card recipe-form"
        onSubmit={handleSubmit}
      >
        <RecipeFormFields
          values={values}
          readOnly={false}
          {...formHandlers}
        />

        <div className="recipe-form__actions">
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? "Saving..." : "Save Recipe"}
          </button>
          <Link className="btn btn--ghost" to="/app/recipes">
            Cancel
          </Link>
        </div>
      </form>
      <div className="recipe-sticky-actions" aria-label="Recipe create actions">
        <button
          type="submit"
          form="recipe-create-form"
          className="btn btn--primary"
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Recipe"}
        </button>
      </div>
    </section>
  );
}
