import { scaleQuantityText } from "../../../lib/utils/quantities";
import { groupSubstitutes } from "../utils/ingredientGroups";
import type { RecipeFormIngredient } from "../utils/recipeForm";
import { useTickedItems } from "./useTickedItems";

type Props = {
  /** The recipe's ingredients (blank rows already left out). */
  ingredients: RecipeFormIngredient[];
  /** The recipe's own servings, and the servings being viewed, to scale amounts. */
  baseServings: number | null;
  viewServings: number | null;
};

/**
 * A recipe's ingredients, each on its own row: the amount (scaled to the
 * servings shown) in bold, then the name, its notes, and any substitutes.
 * Tapping a row ticks it off while gathering or adding; that's only for this
 * visit, never saved, and changing servings keeps the ticks.
 */
export default function RecipeIngredientList({ ingredients, baseServings, viewServings }: Props) {
  const groups = groupSubstitutes(ingredients);
  const ticks = useTickedItems<string>(groups.map(({ main }) => main.id).join("|"));

  if (groups.length === 0) return <p>No ingredients added yet.</p>;

  const amount = (ingredient: RecipeFormIngredient) =>
    [scaleQuantityText(ingredient.quantity, baseServings, viewServings), ingredient.unit.trim()]
      .filter((part) => part.length > 0)
      .join(" ");

  return (
    <div className="recipe-ingredient-list">
      <p className="recipe-ingredient-list__hint">Tap an ingredient to tick it off.</p>
      <ul className="recipe-ingredient-list__items">
        {groups.map(({ main, substitutes }) => {
          const ticked = ticks.isTicked(main.id);
          const mainAmount = amount(main);
          const name = main.ingredientName.trim() || (mainAmount ? "" : "Unnamed ingredient");
          return (
            <li key={main.id}>
              <button
                type="button"
                className={`recipe-ingredient-list__item${ticked ? " recipe-ingredient-list__item--ticked" : ""}`}
                aria-pressed={ticked}
                onClick={() => ticks.toggle(main.id)}
              >
                <span className="recipe-ingredient-list__check" aria-hidden="true">
                  {ticked ? "✓" : ""}
                </span>
                <span className="recipe-ingredient-list__body">
                  <span className="recipe-ingredient-list__line">
                    {mainAmount ? <strong className="recipe-ingredient-list__amount">{mainAmount}</strong> : null}
                    {mainAmount && name ? " " : null}
                    {name ? <span className="recipe-ingredient-list__name">{name}</span> : null}
                  </span>
                  {main.notes.trim() ? (
                    <span className="recipe-ingredient-list__note">{main.notes.trim()}</span>
                  ) : null}
                  {substitutes.map((substitute) => {
                    const substituteAmount = amount(substitute);
                    return (
                      <span key={substitute.id} className="recipe-ingredient-list__substitute">
                        {"or "}
                        {substituteAmount ? <strong>{substituteAmount}</strong> : null}
                        {substituteAmount ? " " : null}
                        {substitute.ingredientName.trim()}
                        {substitute.notes.trim() ? ` (${substitute.notes.trim()})` : ""}
                      </span>
                    );
                  })}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {ticks.count > 0 ? (
        <div className="recipe-ingredient-list__footer">
          <span className="recipe-ingredient-list__progress" aria-live="polite">
            {ticks.count} of {groups.length} ready
          </span>
          <button type="button" className="btn btn--ghost btn--small" onClick={ticks.reset}>
            Reset ingredients
          </button>
        </div>
      ) : null}
    </div>
  );
}
