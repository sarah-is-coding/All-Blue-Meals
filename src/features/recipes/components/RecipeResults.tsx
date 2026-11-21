import { Link } from "react-router-dom";
import type { MealType } from "../../meal-plans/types";
import type { RecipeSummary } from "../types";
import StarRating from "./StarRating";

type RecipeResultsProps = {
  recipes: RecipeSummary[];
  loading: boolean;
  totalCount: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  /** Set when picking a recipe for a planner slot; passed on to the recipe page. */
  mealSlot?: { date: string; mealType: MealType };
  /** Called before opening a recipe, so the list can be restored on the way back. */
  onOpenRecipe: () => void;
  /** What to say when nothing matches. */
  emptyMessage?: string;
};

const formatTotalMinutes = (recipe: RecipeSummary): string => {
  const totalMinutes = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);
  if (totalMinutes <= 0) {
    return "No time set";
  }
  return `${totalMinutes} min total`;
};

/** A page of recipe cards, with paging; used by the list view and inside a tag folder. */
export default function RecipeResults({
  recipes,
  loading,
  totalCount,
  currentPage,
  pageSize,
  onPageChange,
  mealSlot,
  onOpenRecipe,
  emptyMessage = "Try a different search or add your first recipe.",
}: RecipeResultsProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pageStartIndex = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEndIndex = Math.min(currentPage * pageSize, totalCount);

  return (
    <section aria-live="polite" aria-busy={loading}>
      {loading ? (
        <article className="workspace-card">
          <p>Loading recipes...</p>
        </article>
      ) : recipes.length === 0 ? (
        <article className="workspace-card">
          <h2>No recipes found</h2>
          <p>{emptyMessage}</p>
        </article>
      ) : (
        <>
          <ul className="recipe-list">
            {recipes.map((recipe) => (
              <li key={recipe.id}>
                <Link
                  className="recipe-card"
                  to={`/recipes/${recipe.id}`}
                  state={mealSlot ? { from: "meal-planner", mealSlot } : undefined}
                  onClick={onOpenRecipe}
                >
                  <div className="recipe-card__head">
                    <h2>{recipe.title}</h2>
                    <span>{formatTotalMinutes(recipe)}</span>
                  </div>
                  <StarRating value={recipe.rating} size="sm" />
                  {recipe.description ? <p>{recipe.description}</p> : null}
                  <div className="recipe-card__meta">
                    {recipe.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="recipe-tag">
                        {tag}
                      </span>
                    ))}
                    {recipe.hasSource ? (
                      <span className="recipe-tag recipe-tag--source">Has source</span>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {totalPages > 1 ? (
            <nav className="recipe-pagination" aria-label="Recipe result pages">
              <p className="recipe-pagination__summary">
                Showing {pageStartIndex}-{pageEndIndex} of {totalCount}
              </p>
              <div className="recipe-pagination__controls">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
                <span className="recipe-pagination__count">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </div>
            </nav>
          ) : null}
        </>
      )}
    </section>
  );
}
