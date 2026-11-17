import { useIngredientMatches } from "../../ingredients/queries";
import type { ImportedRecipe } from "../types";
import { importedIngredientRows } from "../utils/importedIngredients";

let tagRowId = 0;
const nextId = () => `tag-${tagRowId++}`;

/**
 * "2 new ingredients" on an import result: how many of its ingredients
 * (after the naming rules) aren't in the catalog yet and would be created by
 * "Create". Nothing is shown while checking or when none are new.
 */
export default function ImportedNewIngredientsTag({ recipe }: { recipe: ImportedRecipe }) {
  const rows = importedIngredientRows(recipe.ingredients, nextId);
  const { matchFor, isNew } = useIngredientMatches(
    rows.flatMap((row) => (row.canonicalName ? [row.ingredientName, row.canonicalName] : [row.ingredientName]))
  );
  // A row is new when neither its name nor its canonical name is in the catalog.
  const newCount = rows.filter(
    (row) =>
      isNew(row.ingredientName) && !(row.canonicalName && matchFor(row.canonicalName))
  ).length;
  if (newCount === 0) return null;
  return (
    <span className="recipe-tag recipe-tag--new">
      {newCount === 1 ? "1 new ingredient" : `${newCount} new ingredients`}
    </span>
  );
}
