import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useIngredientMatches } from "../../ingredients/queries";
import { ingredientKey } from "../../ingredients/utils/ingredientKey";
import RecipeFormFields from "../components/RecipeFormFields";
import type { IngredientMatchStatus } from "../components/RecipeIngredientCard";
import { useRecipeActions } from "../queries";
import type { ImportedRecipe } from "../types";
import {
  createEmptyRecipeFormValues,
  mapRecipeFormValuesToInput,
  type RecipeFormIngredient,
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

  // An imported draft's rows aren't linked to the catalog yet: label each as
  // matching an existing ingredient (or its canonical name) or as new.
  const isImportedDraft = Boolean(locationState?.importedRecipe);
  const unlinked = isImportedDraft
    ? values.ingredients.filter((row) => !row.ingredientId && row.ingredientName.trim())
    : [];
  const matches = useIngredientMatches(
    unlinked.flatMap((row) => [row.ingredientName, ...(row.canonicalName ? [row.canonicalName] : [])])
  );
  const matchStatusFor = (row: RecipeFormIngredient): IngredientMatchStatus => {
    if (row.ingredientId || !row.ingredientName.trim()) return null;
    const match =
      matches.matchFor(row.ingredientName) ?? (row.canonicalName ? matches.matchFor(row.canonicalName) : null);
    if (match) {
      // Only worth saying when the catalog name differs from what's written.
      return ingredientKey(match.name) === ingredientKey(row.ingredientName)
        ? null
        : { kind: "matched", name: match.name };
    }
    return matches.isNew(row.ingredientName) ? { kind: "new" } : null;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const recipeId = await createRecipe(mapRecipeFormValuesToInput(values));
      navigate(`/recipes/${recipeId}`);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Failed to create recipe."
      );
      setSaving(false);
    }
  };

  return (
    <section className="workspace-route recipe-route">
      <article className="workspace-card">
        <div className="recipe-page-header">
          <h1>Add Recipe</h1>
          <Link className="btn btn--ghost" to="/recipes">
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
          matchStatusFor={isImportedDraft ? matchStatusFor : undefined}
        />

        {/* One Save button, sticky until you reach the end of the form. */}
        <div className="recipe-form__actions">
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? "Saving..." : "Save Recipe"}
          </button>
          <Link className="btn btn--ghost" to="/recipes">
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}
