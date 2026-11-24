import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import LoadingModal from "../../../components/feedback/LoadingModal";
import AddToPlanButton from "../../meal-plans/components/AddToPlanButton";
import RecipeBackLinks, { type RecipeBackLinksState } from "../components/RecipeBackLinks";
import RecipeDeleteControls from "../components/RecipeDeleteControls";
import RecipeFormFields from "../components/RecipeFormFields";
import RecipeNotes from "../components/RecipeNotes";
import RecipeReadArticle from "../components/RecipeReadArticle";
import RecipeScaleTools from "../components/RecipeScaleTools";
import StarRating from "../components/StarRating";
import { useRecipe, useRecipeActions } from "../queries";
import {
  mapRecipeDetailToFormValues,
  mapRecipeFormValuesToInput,
  type RecipeFormValues,
} from "../utils/recipeForm";
import { createRecipeFormHandlers } from "../utils/recipeFormHandlers";
import { parseServingsValue, scaleIngredientsToServings } from "../utils/ingredientScaling";

type RecipeDetailLocationState = RecipeBackLinksState & {
  plannedMealId?: string;
  initialServings?: number | null;
};

export default function RecipeDetailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { recipeId } = useParams();
  const { recipe, loading } = useRecipe(recipeId ?? null);
  const recipeActions = useRecipeActions();
  const locationState = (location.state ?? null) as RecipeDetailLocationState | null;
  const backLinks = <RecipeBackLinks state={locationState} />;
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<RecipeFormValues | null>(null);
  const [snapshot, setSnapshot] = useState<RecipeFormValues | null>(null);
  const [viewServings, setViewServings] = useState<number | null>(null);
  const [editScaleBaseServings, setEditScaleBaseServings] = useState<number | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [savingRating, setSavingRating] = useState(false);

  // Set up the form once per visit to a recipe. A new navigation (e.g. from the
  // planner with a different serving size) starts fresh; background refreshes
  // of the cached recipe never overwrite edits in progress.
  const visitKey = `${recipeId ?? ""}|${location.key}`;
  const [initializedVisit, setInitializedVisit] = useState<string | null>(null);
  if (recipe !== undefined && initializedVisit !== visitKey) {
    setInitializedVisit(visitKey);
    setError(null);
    setMessage(null);
    setEditing(false);
    if (recipe) {
      const nextValues = mapRecipeDetailToFormValues(recipe);
      const recipeBaseServings = parseServingsValue(nextValues.servings);
      const initialServingsFromMealPlan = parseServingsValue(locationState?.initialServings);
      setFormValues(nextValues);
      setSnapshot(nextValues);
      setViewServings(initialServingsFromMealPlan ?? recipeBaseServings);
      setEditScaleBaseServings(recipeBaseServings);
      setRating(recipe.rating);
    } else {
      setFormValues(null);
      setSnapshot(null);
      setViewServings(null);
      setEditScaleBaseServings(null);
      setRating(null);
    }
  }

  const formHandlers = createRecipeFormHandlers((change) =>
    setFormValues((previousValues) => (previousValues ? change(previousValues) : previousValues))
  );

  const handleCancelEdit = () => {
    if (snapshot) {
      setFormValues(snapshot);
      setEditScaleBaseServings(parseServingsValue(snapshot.servings));
    }
    setEditing(false);
    setError(null);
    setMessage(null);
  };

  const handleScaleIngredientsForServings = () => {
    if (!formValues) {
      return;
    }
    const result = scaleIngredientsToServings(
      formValues.ingredients,
      editScaleBaseServings,
      formValues.servings
    );
    if (result.kind === "error") {
      setError(result.message);
      return;
    }
    if (result.kind === "scaled") {
      setFormValues((previousValues) =>
        previousValues ? { ...previousValues, ingredients: result.ingredients } : previousValues
      );
      setEditScaleBaseServings(result.servings);
    }
    setError(null);
    setMessage(result.message);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing || !recipeId || !formValues) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const previousSnapshotServings = parseServingsValue(snapshot?.servings ?? null);
      // Also refreshes recipe lists and the planner, which shows titles and servings.
      await recipeActions.update(recipeId, mapRecipeFormValuesToInput(formValues));
      setSnapshot(formValues);
      setEditing(false);
      const nextRecipeBaseServings = parseServingsValue(formValues.servings);
      setEditScaleBaseServings(nextRecipeBaseServings);
      setViewServings((currentViewServings) =>
        currentViewServings === null || currentViewServings === previousSnapshotServings
          ? nextRecipeBaseServings
          : currentViewServings
      );
      setMessage("Recipe saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save recipe.");
    } finally {
      setSaving(false);
    }
  };

  const handleRateChange = async (nextRating: number | null) => {
    if (!recipeId) {
      return;
    }

    setSavingRating(true);
    setError(null);

    try {
      await recipeActions.rate(recipeId, nextRating);
      setRating(nextRating);
    } catch (rateError) {
      setError(rateError instanceof Error ? rateError.message : "Failed to update rating.");
    } finally {
      setSavingRating(false);
    }
  };

  const handleDelete = async () => {
    if (!recipeId) {
      return;
    }
    // Also refreshes recipe lists and the planner, whose meals lose this recipe.
    await recipeActions.remove(recipeId);
    navigate("/recipes");
  };

  // Rendered as the first child of every branch below so it stays mounted
  // when loading finishes and LoadingModal can apply its minimum display time.
  const loadingModal = (
    <LoadingModal open={loading} title="Loading recipe..." message="Pulling in your recipe details." />
  );

  if (loading) {
    return <section className="workspace-route recipe-route">{loadingModal}</section>;
  }

  if (!formValues) {
    return (
      <section className="workspace-route recipe-route">
        {loadingModal}
        <article className="workspace-card recipe-empty-state">
          <h1>Recipe not found</h1>
          <p>This recipe may have been removed or you might not have access.</p>
          {backLinks}
        </article>
      </section>
    );
  }

  const recipeBaseServings = parseServingsValue(formValues.servings);
  const canScaleInEditMode = Boolean(
    editing && recipeBaseServings && editScaleBaseServings && recipeBaseServings !== editScaleBaseServings
  );

  const startEditing = () => {
    setEditing(true);
    setEditScaleBaseServings(parseServingsValue(formValues.servings));
    setError(null);
    setMessage(null);
  };

  return (
    <section className="workspace-route recipe-route">
      {loadingModal}
      <article className="workspace-card">
        <div className="recipe-page-header">
          <div className="recipe-page-header__title">
            <h1>{formValues.title || "Recipe Details"}</h1>
            {!editing ? (
              <StarRating
                value={rating}
                onChange={handleRateChange}
                disabled={savingRating}
                label="Rate this recipe"
              />
            ) : null}
          </div>
          <div className="recipe-page-header__actions">
            {backLinks}
            {!editing && recipeId ? (
              <AddToPlanButton
                recipeId={recipeId}
                recipeTitle={formValues.title}
                recipeServings={recipeBaseServings}
                initialDay={locationState?.mealSlot?.date}
                initialMealType={locationState?.mealSlot?.mealType}
              />
            ) : null}
            {editing ? (
              <button type="button" className="btn btn--ghost" onClick={handleCancelEdit} disabled={saving}>
                Cancel
              </button>
            ) : (
              <RecipeDeleteControls
                onDelete={handleDelete}
                onError={(deleteError) => {
                  setError(deleteError);
                  setMessage(null);
                }}
                otherActions={
                  <button type="button" className="btn btn--primary" onClick={startEditing}>
                    Edit
                  </button>
                }
              />
            )}
          </div>
        </div>
        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="message">{message}</p> : null}
      </article>

      {editing ? (
        <form id="recipe-edit-form" className="workspace-card recipe-form" onSubmit={handleSave}>
          <RecipeFormFields values={formValues} readOnly={false} {...formHandlers} />
          <RecipeScaleTools
            baseServings={editScaleBaseServings}
            targetServings={recipeBaseServings}
            canScale={canScaleInEditMode}
            disabled={saving}
            onScale={handleScaleIngredientsForServings}
          />
          {/* One Save button, sticky until you reach the end of the form. */}
          <div className="recipe-form__actions">
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      ) : (
        <>
          <RecipeReadArticle
            values={formValues}
            baseServings={recipeBaseServings}
            viewServings={viewServings}
            onViewServingsChange={setViewServings}
          />
          {recipeId ? <RecipeNotes recipeId={recipeId} /> : null}
        </>
      )}
    </section>
  );
}
