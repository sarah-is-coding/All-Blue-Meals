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
};

export default function RecipeIngredientCard({
  ingredient,
  readOnly,
  isSubstitute,
  canRemove,
  onIngredientChange,
  onIngredientSelect,
  onRemove,
  onAddSubstitute,
}: RecipeIngredientCardProps) {
  return (
    <article
      className={[
        "recipe-ingredient-card",
        isSubstitute ? "recipe-ingredient-card--substitute" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={isSubstitute ? "Substitute ingredient" : undefined}
    >
      {isSubstitute ? <span className="recipe-ingredient-card__or">or</span> : null}
      <div className="recipe-ingredient-card__grid">
        <div className="recipe-field recipe-field--full">
          <span>{isSubstitute ? "Substitute" : "Ingredient"}</span>
          <IngredientNameCombobox
            value={ingredient.ingredientName}
            onSelect={(ingredientId, name) => onIngredientSelect(ingredient.id, ingredientId, name)}
            readOnly={readOnly}
          />
        </div>

        <label className="recipe-field">
          <span>Quantity</span>
          <input
            type="text"
            value={ingredient.quantity}
            onChange={(event) => onIngredientChange(ingredient.id, "quantity", event.target.value)}
            readOnly={readOnly}
          />
        </label>

        <label className="recipe-field">
          <span>Unit</span>
          <input
            type="text"
            value={ingredient.unit}
            onChange={(event) => onIngredientChange(ingredient.id, "unit", event.target.value)}
            readOnly={readOnly}
          />
        </label>

        <label className="recipe-field recipe-field--full">
          <span>Notes</span>
          <input
            type="text"
            value={ingredient.notes}
            onChange={(event) => onIngredientChange(ingredient.id, "notes", event.target.value)}
            readOnly={readOnly}
          />
        </label>
      </div>

      {!readOnly ? (
        <div className="recipe-ingredient-card__actions">
          {onAddSubstitute ? (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => onAddSubstitute(ingredient.id)}
            >
              + Add substitute
            </button>
          ) : null}
          {canRemove ? (
            <button
              type="button"
              className="btn btn--ghost recipe-ingredient-card__remove"
              onClick={() => onRemove(ingredient.id)}
            >
              Remove
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
