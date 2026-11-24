import type { RecipeFormIngredient, RecipeFormValues } from "../utils/recipeForm";
import type { RecipeFormHandlers } from "../utils/recipeFormHandlers";
import { groupSubstitutes } from "../utils/ingredientGroups";
import RecipeIngredientCard, { type IngredientMatchStatus } from "./RecipeIngredientCard";
import { useFocusAddedRow } from "./useFocusAddedRow";

type RecipeFormFieldsProps = RecipeFormHandlers & {
  values: RecipeFormValues;
  readOnly: boolean;
  /** Labels rows as new or matched (imported drafts); omitted elsewhere. */
  matchStatusFor?: (row: RecipeFormIngredient) => IngredientMatchStatus;
};

export default function RecipeFormFields({
  values,
  readOnly,
  onFieldChange,
  onIngredientChange,
  onIngredientSelect,
  onAddIngredient,
  onAddSubstitute,
  onRemoveIngredient,
  matchStatusFor,
}: RecipeFormFieldsProps) {
  const groups = groupSubstitutes(values.ingredients);
  // A new ingredient or substitute is scrolled to and focused, wherever it lands.
  const { listRef, expectAddedRow } = useFocusAddedRow(values.ingredients.map((row) => row.id));
  const addIngredient = () => {
    expectAddedRow();
    onAddIngredient();
  };
  const addSubstitute = (mainRowId: string) => {
    expectAddedRow();
    onAddSubstitute(mainRowId);
  };
  return (
    <>
      {/* ── Basics ──────────────────────────────────────────────── */}
      <section className="recipe-form__section">
        <h3 className="recipe-form__section-title">Basics</h3>
        <div className="recipe-form__grid">
          <label className="recipe-field recipe-field--full">
            <span>Title</span>
            <input
              type="text"
              value={values.title}
              onChange={(event) => onFieldChange("title", event.target.value)}
              readOnly={readOnly}
              required
            />
          </label>

          <label className="recipe-field recipe-field--full">
            <span>Description</span>
            <textarea
              value={values.description}
              onChange={(event) => onFieldChange("description", event.target.value)}
              readOnly={readOnly}
              rows={3}
            />
          </label>
        </div>
      </section>

      {/* ── Details ─────────────────────────────────────────────── */}
      <section className="recipe-form__section">
        <h3 className="recipe-form__section-title">Details</h3>
        <div className="recipe-form__grid">
          {/* Short numbers: side by side on every screen. */}
          <div className="recipe-form__numbers recipe-field--full">
            <label className="recipe-field">
              <span>Prep (min)</span>
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={values.prepMinutes}
                onChange={(event) => onFieldChange("prepMinutes", event.target.value)}
                readOnly={readOnly}
              />
            </label>

            <label className="recipe-field">
              <span>Cook (min)</span>
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={values.cookMinutes}
                onChange={(event) => onFieldChange("cookMinutes", event.target.value)}
                readOnly={readOnly}
              />
            </label>

            <label className="recipe-field">
              <span>Servings</span>
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={values.servings}
                onChange={(event) => onFieldChange("servings", event.target.value)}
                readOnly={readOnly}
              />
            </label>
          </div>

          <label className="recipe-field recipe-field--full">
            <span>Source URL</span>
            <input
              type="url"
              placeholder="https://example.com/recipe"
              value={values.sourceUrl}
              onChange={(event) => onFieldChange("sourceUrl", event.target.value)}
              readOnly={readOnly}
            />
          </label>

          <label className="recipe-field recipe-field--full">
            <span>Tags (comma separated)</span>
            <input
              type="text"
              placeholder="high-protein, quick, kid-friendly"
              value={values.tags}
              onChange={(event) => onFieldChange("tags", event.target.value)}
              readOnly={readOnly}
            />
          </label>
        </div>
      </section>

      {/* ── Ingredients ─────────────────────────────────────────── */}
      <section className="recipe-form__section recipe-form__section--ingredients">
        <div className="recipe-ingredients__header">
          <h3 className="recipe-form__section-title">Ingredients</h3>
          {!readOnly ? (
            <button type="button" className="btn btn--ghost" onClick={addIngredient}>
              + Add ingredient
            </button>
          ) : null}
        </div>

        {/* Column headings for the one-line rows on wide screens; on phones the
            placeholders say what goes where. Each field has its own accessible name. */}
        <div className="recipe-ingredients__columns" aria-hidden="true">
          <span>Ingredient</span>
          <span>Qty</span>
          <span>Unit</span>
          <span>Notes</span>
        </div>

        <div className="recipe-ingredients__list" ref={listRef}>
          {groups.flatMap(({ main, substitutes }) => [
            <RecipeIngredientCard
              key={main.id}
              ingredient={main}
              readOnly={readOnly}
              isSubstitute={false}
              canRemove={groups.length > 1}
              onIngredientChange={onIngredientChange}
              onIngredientSelect={onIngredientSelect}
              onRemove={onRemoveIngredient}
              matchStatus={matchStatusFor?.(main) ?? null}
              onAddSubstitute={addSubstitute}
            />,
            ...substitutes.map((substitute) => (
              <RecipeIngredientCard
                key={substitute.id}
                ingredient={substitute}
                readOnly={readOnly}
                isSubstitute
                canRemove
                onIngredientChange={onIngredientChange}
                onIngredientSelect={onIngredientSelect}
                onRemove={onRemoveIngredient}
                matchStatus={matchStatusFor?.(substitute) ?? null}
              />
            )),
          ])}
        </div>

        {!readOnly ? (
          <button
            type="button"
            className="btn btn--ghost recipe-ingredients__add-bottom"
            onClick={addIngredient}
          >
            + Add ingredient
          </button>
        ) : null}
      </section>

      {/* ── Instructions ────────────────────────────────────────── */}
      <section className="recipe-form__section">
        <h3 className="recipe-form__section-title">Instructions</h3>
        <label className="recipe-field">
          <span className="sr-only">Instructions</span>
          <textarea
            className="recipe-form__instructions"
            placeholder={"1. Preheat the oven…\n2. …"}
            value={values.instructions}
            onChange={(event) => onFieldChange("instructions", event.target.value)}
            readOnly={readOnly}
            rows={8}
          />
        </label>
      </section>
    </>
  );
}
