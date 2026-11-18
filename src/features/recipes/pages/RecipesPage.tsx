import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import RecipeFiltersPanel from "../components/RecipeFiltersPanel";
import RecipeResults from "../components/RecipeResults";
import RecipeTagFolders from "../components/RecipeTagFolders";
import RecipeViewMenu from "../components/RecipeViewMenu";
import { useRecipeList, useRecipeTagFolders } from "../queries";
import { MEAL_TYPE_OPTIONS } from "../../meal-plans/constants";
import { createDateFromIso } from "../../../lib/utils/dates";
import type { MealType } from "../../meal-plans/types";
import type { RecipeListFilters, RecipeListView } from "../types";
import {
  clearRecipeListViewState,
  loadRecipeListViewState,
  saveRecipeListViewState,
} from "../utils/recipeListViewState";
import { filterTagFolders } from "../utils/recipeTagFolders";

const RECIPES_PER_PAGE = 12;

type MealSlot = { date: string; mealType: MealType };
type RecipesPageLocationState = { mealSlot?: MealSlot };

const mealSlotDateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

const formatMealSlot = (mealSlot: MealSlot): string => {
  const mealTypeLabel =
    MEAL_TYPE_OPTIONS.find((option) => option.value === mealSlot.mealType)?.label ??
    mealSlot.mealType;
  return `${mealSlotDateFormatter.format(createDateFromIso(mealSlot.date))} · ${mealTypeLabel}`;
};

export default function RecipesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const mealSlot = (location.state as RecipesPageLocationState | null)?.mealSlot;
  const [initialState] = useState(loadRecipeListViewState);
  const [searchInput, setSearchInput] = useState(initialState.searchInput);
  const [searchTerm, setSearchTerm] = useState(initialState.searchInput.trim());
  const [filters, setFilters] = useState<RecipeListFilters>(initialState.filters);
  const [currentPage, setCurrentPage] = useState(initialState.currentPage);
  const [showFilters, setShowFilters] = useState(false);
  // One toolbar menu open at a time: on phones they open in the same place.
  const [openMenu, setOpenMenu] = useState<"view" | "add" | null>(null);
  const showAddMenu = openMenu === "add";
  const [view, setView] = useState<RecipeListView>(initialState.view);
  // In the tag folders view: the open folder's tag (lowercase), or null for all folders.
  const [openTag, setOpenTag] = useState<string | null>(initialState.view === "tags" ? initialState.openTag : null);
  const showingFolders = view === "tags" && openTag === null;
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const debounceId = window.setTimeout(() => {
      setSearchTerm(searchInput.trim());
    }, 220);

    return () => window.clearTimeout(debounceId);
  }, [searchInput]);

  // Inside a tag folder, the folder decides the tag; the other filters still apply.
  const { recipes, totalCount, loading, error } = useRecipeList(
    {
      searchTerm,
      filters: view === "tags" ? { ...filters, tag: openTag ?? "" } : filters,
      page: currentPage,
      pageSize: RECIPES_PER_PAGE,
    },
    !showingFolders
  );
  const tagFolders = useRecipeTagFolders(view === "tags");
  // While looking at the folders, the search box narrows down the folders.
  const visibleFolders = filterTagFolders(tagFolders.folders, searchInput);
  const openFolder = tagFolders.folders.find((folder) => folder.key === openTag);

  const totalPages = Math.max(1, Math.ceil(totalCount / RECIPES_PER_PAGE));

  // If filters shrink the results below the current page, go to the last page.
  // Only once the count has loaded: while a page loads it reads as 0.
  if (!loading && currentPage > totalPages) {
    setCurrentPage(totalPages);
  }

  const persistListState = () => {
    saveRecipeListViewState({
      searchInput,
      filters,
      currentPage,
      view,
      openTag,
    });
  };

  const changeView = (nextView: RecipeListView) => {
    setView(nextView);
    setOpenTag(null);
    setCurrentPage(1);
  };

  const openTagFolder = (tag: string | null) => {
    setOpenTag(tag);
    setSearchInput("");
    setSearchTerm("");
    setCurrentPage(1);
  };

  return (
    <section className="workspace-route recipe-route">
      <article className="workspace-card recipe-shell">
        <h1>Recipes</h1>

        {mealSlot ? (
          <p className="recipe-meal-slot-banner">
            Picking a recipe for <strong>{formatMealSlot(mealSlot)}</strong>
            {" · "}
            <button
              type="button"
              className="recipe-meal-slot-banner__cancel"
              onClick={() => navigate(location.pathname, { replace: true, state: null })}
            >
              Cancel
            </button>
          </p>
        ) : null}

        <div className="recipe-toolbar">
          {/* Typing searches after a short pause; Search (or Enter) searches now. */}
          <form
            className="recipe-search-form"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              setSearchTerm(searchInput.trim());
              setCurrentPage(1);
            }}
          >
            <label className="recipe-search" htmlFor="recipe-search-input">
              <span className="sr-only">{showingFolders ? "Search tags" : "Search recipes"}</span>
              <input
                ref={searchInputRef}
                id="recipe-search-input"
                type="search"
                placeholder={showingFolders ? "Search tags..." : "Search recipes..."}
                value={searchInput}
                onChange={(event) => {
                  setSearchInput(event.target.value);
                  setCurrentPage(1);
                }}
              />
              {searchInput ? (
                <button
                  type="button"
                  className="recipe-search__clear"
                  aria-label="Clear recipe search"
                  onClick={() => {
                    setSearchInput("");
                    setCurrentPage(1);
                    searchInputRef.current?.focus();
                  }}
                >
                  &times;
                </button>
              ) : null}
            </label>
            <button type="submit" className="btn btn--primary recipe-search-form__submit">
              Search
            </button>
          </form>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setShowFilters((currentState) => !currentState)}
            aria-expanded={showFilters}
            aria-controls="recipe-filters-panel"
          >
            Filters
          </button>
          <RecipeViewMenu
            view={view}
            onChange={changeView}
            open={openMenu === "view"}
            onOpenChange={(open) => setOpenMenu(open ? "view" : null)}
          />
          <div className="recipe-add-menu">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setOpenMenu(showAddMenu ? null : "add")}
              aria-expanded={showAddMenu}
              aria-controls="recipe-add-menu"
            >
              Add Recipe
            </button>
            {showAddMenu ? (
              <div
                id="recipe-add-menu"
                className="recipe-add-menu__panel"
                role="menu"
              >
                <Link
                  className="recipe-add-menu__item"
                  to="/app/recipes/new"
                  state={{ prefillTitle: searchInput.trim() }}
                  role="menuitem"
                  onClick={() => clearRecipeListViewState()}
                >
                  Add Recipe
                </Link>
                <Link
                  className="recipe-add-menu__item"
                  to="/app/recipes/import"
                  role="menuitem"
                  onClick={() => clearRecipeListViewState()}
                >
                  Import Recipe
                </Link>
                <Link
                  className="recipe-add-menu__item"
                  to="/app/recipes/generate"
                  role="menuitem"
                  onClick={() => clearRecipeListViewState()}
                >
                  Generate Recipe
                </Link>
              </div>
            ) : null}
          </div>
        </div>

        {showFilters ? (
          <RecipeFiltersPanel
            filters={filters}
            showTag={view === "list"}
            onChange={(nextFilters) => {
              setFilters(nextFilters);
              setCurrentPage(1);
            }}
          />
        ) : null}

        {error ? <p className="error">{error}</p> : null}
      </article>

      {showingFolders ? (
        <RecipeTagFolders
          folders={visibleFolders}
          loading={tagFolders.loading}
          error={tagFolders.error}
          filtered={tagFolders.folders.length > 0 && searchInput.trim() !== ""}
          onOpen={(folder) => openTagFolder(folder.key)}
        />
      ) : (
        <>
          {view === "tags" ? (
            <div className="recipe-tag-folder-header">
              <button type="button" className="btn btn--ghost" onClick={() => openTagFolder(null)}>
                ← All tags
              </button>
              <h2>{openFolder?.label ?? openTag}</h2>
            </div>
          ) : null}
          <RecipeResults
            recipes={recipes}
            loading={loading}
            totalCount={totalCount}
            currentPage={currentPage}
            pageSize={RECIPES_PER_PAGE}
            onPageChange={setCurrentPage}
            mealSlot={mealSlot}
            onOpenRecipe={persistListState}
            emptyMessage={view === "tags" ? "No recipes in this folder match the search or filters." : undefined}
          />
        </>
      )}
    </section>
  );
}
