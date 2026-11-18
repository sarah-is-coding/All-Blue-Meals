import type { RecipeListFilters } from "../types";
import { createDefaultRecipeListFilters } from "../utils/recipeListViewState";

type RecipeFiltersPanelProps = {
  filters: RecipeListFilters;
  /** The Tag field; hidden in the tag folders view, where the folder decides the tag. */
  showTag: boolean;
  onChange: (filters: RecipeListFilters) => void;
};

/** Sort and filters for the recipe search, shown under the toolbar. */
export default function RecipeFiltersPanel({ filters, showTag, onChange }: RecipeFiltersPanelProps) {
  const update = (change: Partial<RecipeListFilters>) => onChange({ ...filters, ...change });

  return (
    <section id="recipe-filters-panel" className="recipe-filters" aria-label="Recipe filters">
      <label className="recipe-field">
        <span>Sort</span>
        <select
          value={filters.sort}
          onChange={(event) => update({ sort: event.target.value as RecipeListFilters["sort"] })}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="title_asc">Title A-Z</option>
          <option value="title_desc">Title Z-A</option>
        </select>
      </label>

      {showTag ? (
        <label className="recipe-field">
          <span>Tag</span>
          <input
            type="text"
            placeholder="weeknight"
            value={filters.tag}
            onChange={(event) => update({ tag: event.target.value })}
          />
        </label>
      ) : null}

      <label className="recipe-checkbox">
        <input
          type="checkbox"
          checked={filters.onlyWithSource}
          onChange={(event) => update({ onlyWithSource: event.target.checked })}
        />
        <span>Only recipes with source URL</span>
      </label>

      <label className="recipe-field">
        <span>Minimum rating</span>
        <select value={filters.minRating} onChange={(event) => update({ minRating: Number(event.target.value) })}>
          <option value={0}>Any</option>
          <option value={1}>1+ stars</option>
          <option value={2}>2+ stars</option>
          <option value={3}>3+ stars</option>
          <option value={4}>4+ stars</option>
          <option value={5}>5 stars</option>
        </select>
      </label>

      <button type="button" className="btn btn--ghost" onClick={() => onChange(createDefaultRecipeListFilters())}>
        Reset filters
      </button>
    </section>
  );
}
