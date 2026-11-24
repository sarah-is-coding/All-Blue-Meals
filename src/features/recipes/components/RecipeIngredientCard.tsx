import type { RecipeFormIngredient, RecipeIngredientFieldName } from "../utils/recipeForm";
import IngredientNameCombobox from "./IngredientNameCombobox";

type RecipeIngredientCardProps = {
  ingredient: RecipeFormIngredient;
  readOnly: boolean;
  /** A substitute row: shown indented under its main row with an "or" label. */
  isSubstitute: boolean;
  canRemove: boolean;
  onIngredientChange: (rowId: string, field: RecipeIngredientFieldName, value: string) => void;
  onIngredientSelect: (rowId: string, ingredientId: string, name: string) => void;
  onRemove: (rowId: string) => void;
  /** Only passed for main rows. */
  onAddSubstitute?: (mainRowId: string) => void;
  /** For imported rows: whether the name is new to the catalog or matches an ingredient. */
  matchStatus?: IngredientMatchStatus;
};

export type IngredientMatchStatus = { kind: "new" } | { kind: "matched"; name: string } | null;

/**
 * One ingredient in the recipe form, kept compact so a long list doesn't mean
 * endless scrolling. On phones: the name (with the row's buttons) on top, then
 * quantity, unit and notes side by side. On wide screens it's a single line
 * under the column headings RecipeFormFields shows. The fields have no visible
 * labels (placeholders say what goes where), so each has an accessible name.
 */
export default function RecipeIngredientCard({
  ingredient,
  readOnly,
  isSubstitute,
  canRemove,
  onIngredientChange,
  onIngredientSelect,
  onRemove,
  onAddSubstitute,
  matchStatus = null,
}: RecipeIngredientCardProps) {
  const name = ingredient.ingredientName.trim();
  const kind = isSubstitute ? "Substitute" : "Ingredient";
  const showActions = !readOnly && (Boolean(onAddSubstitute) || canRemove);

  return (
    <article
      className={[
        "recipe-ingredient-card",
        isSubstitute ? "recipe-ingredient-card--substitute" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={isSubstitute ? "Substitute ingredient" : undefined}
      data-row-id={ingredient.id}
    >
      <div className="recipe-ingredient-card__name">
        {isSubstitute ? <span className="recipe-ingredient-card__or">or</span> : null}
        <div className="recipe-ingredient-card__name-field">
          <IngredientNameCombobox
            value={ingredient.ingredientName}
            onSelect={(ingredientId, selectedName) => onIngredientSelect(ingredient.id, ingredientId, selectedName)}
            readOnly={readOnly}
            label={kind}
          />
          {matchStatus?.kind === "new" ? (
            <span className="recipe-ingredient-card__match recipe-ingredient-card__match--new">
              New ingredient
            </span>
          ) : null}
          {matchStatus?.kind === "matched" ? (
            <span className="recipe-ingredient-card__match">{`Matches ${matchStatus.name}`}</span>
          ) : null}
        </div>
      </div>

      <input
        className="recipe-ingredient-card__quantity"
        type="text"
        inputMode="decimal"
        placeholder="Qty"
        aria-label={`Quantity${name ? ` of ${name}` : ""}`}
        value={ingredient.quantity}
        onChange={(event) => onIngredientChange(ingredient.id, "quantity", event.target.value)}
        readOnly={readOnly}
      />
      <input
        className="recipe-ingredient-card__unit"
        type="text"
        placeholder="Unit"
        aria-label={`Unit${name ? ` of ${name}` : ""}`}
        value={ingredient.unit}
        onChange={(event) => onIngredientChange(ingredient.id, "unit", event.target.value)}
        readOnly={readOnly}
      />
      <input
        className="recipe-ingredient-card__notes"
        type="text"
        placeholder="Notes (diced, to taste…)"
        aria-label={`Notes${name ? ` for ${name}` : ""}`}
        value={ingredient.notes}
        onChange={(event) => onIngredientChange(ingredient.id, "notes", event.target.value)}
        readOnly={readOnly}
      />

      {showActions ? (
        <div className="recipe-ingredient-card__actions">
          {onAddSubstitute ? (
            <button
              type="button"
              className="recipe-ingredient-card__icon-button"
              onClick={() => onAddSubstitute(ingredient.id)}
              aria-label={`Add substitute for ${name || "this ingredient"}`}
              title="Add a substitute"
            >
              + or
            </button>
          ) : null}
          {canRemove ? (
            <button
              type="button"
              className="recipe-ingredient-card__icon-button recipe-ingredient-card__remove"
              onClick={() => onRemove(ingredient.id)}
              aria-label={`Remove ${name || (isSubstitute ? "substitute" : "ingredient")}`}
              title="Remove"
            >
              <span aria-hidden="true">×</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
