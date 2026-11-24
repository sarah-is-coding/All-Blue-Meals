import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { PlannedMeal } from "../../features/meal-plans/types";
import { useRecipe, useRecipeNotes } from "../../features/recipes/queries";
import { meatsIn } from "../../features/recipes/utils/recipeMeats";
import { recipePath } from "../../features/recipes/utils/recipePaths";
import { previewTags } from "../../features/recipes/utils/recipeTags";
import { formatTimestampDate } from "../../lib/utils/dates";
import { mealTypeLabel } from "./homeMeals";

// Tags shown on the card; the rest are counted ("+2 more").
const MAX_TAGS = 3;

// Recipe pages opened from here link back home.
const FROM_HOME = { from: "home" } as const;

/** "1 hr 15 min" from prep + cook minutes; null when neither is set. */
const totalTime = (prep: number | null, cook: number | null): string | null => {
  const minutes = (prep ?? 0) + (cook ?? 0);
  if (minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return [hours ? `${hours} hr` : "", rest ? `${rest} min` : ""].filter(Boolean).join(" ");
};

type Props = {
  meal: PlannedMeal;
  /** What to know before cooking it: time, tags, description, meat and
   *  seafood. Off for meals already eaten (Last day's meals). */
  showCookingDetails?: boolean;
  /** Anything a section adds for this meal (e.g. rating it), above the links. */
  children?: ReactNode;
};

/**
 * A planned meal on the home page, the same in every section: what it is, then
 * (for a meal still to cook) how long it takes, its tags (marinate first, so
 * you know to start early) and the meat or seafood it uses (so you know what
 * to thaw or buy), then its latest note, anything the section adds, and links
 * to the recipe and its notes.
 */
export default function HomeMealCard({ meal, showCookingDetails = true, children }: Props) {
  const { recipe, loading } = useRecipe(meal.recipeId);
  // Same cache as the recipe's notes section, so a note added anywhere shows here.
  const { notes } = useRecipeNotes(meal.recipeId);
  const latestNote = notes[0] ?? null;
  const meats = recipe ? meatsIn(recipe.ingredients) : [];
  const tags = previewTags(recipe?.tags ?? [], MAX_TAGS);
  const time = recipe ? totalTime(recipe.prepMinutes, recipe.cookMinutes) : null;
  const servings = meal.effectiveServings;

  return (
    <li className="home-meal">
      <p className="home-meal__type">{mealTypeLabel(meal.mealType)}</p>
      <h3 className="home-meal__title">
        {meal.recipeId ? (
          <Link to={recipePath(meal.recipeId)} state={FROM_HOME}>
            {meal.recipeTitle}
          </Link>
        ) : (
          meal.recipeTitle
        )}
      </h3>

      {showCookingDetails && (servings || time) ? (
        <p className="home-meal__facts">
          {[servings ? `Serves ${servings}` : "", time ?? ""].filter(Boolean).join(" · ")}
        </p>
      ) : null}

      {showCookingDetails && tags.shown.length > 0 ? (
        <div className="home-meal__tags">
          {tags.shown.map((tag) => (
            <span key={tag} className="recipe-tag">
              {tag}
            </span>
          ))}
          {tags.hiddenCount > 0 ? <span className="home-meal__tags-more">+{tags.hiddenCount} more</span> : null}
        </div>
      ) : null}

      {showCookingDetails && recipe?.description ? (
        <p className="home-meal__description">{recipe.description}</p>
      ) : null}

      {!showCookingDetails ? null : loading ? (
        <p className="home-meal__meats home-meal__meats--muted">Loading ingredients…</p>
      ) : recipe ? (
        <p className="home-meal__meats">
          <span className="home-meal__meats-label">Meat &amp; seafood:</span>{" "}
          {meats.length > 0 ? meats.join(", ") : <span className="home-meal__meats--muted">none</span>}
        </p>
      ) : null}

      {latestNote ? (
        <div className="home-meal__note">
          <p className="home-meal__note-label">Latest note · {formatTimestampDate(latestNote.createdAt)}</p>
          <p className="home-meal__note-body">{latestNote.body}</p>
        </div>
      ) : null}

      {children}

      {meal.recipeId ? (
        <div className="home-meal__links">
          <Link className="btn btn--primary" to={recipePath(meal.recipeId)} state={FROM_HOME}>
            Open recipe
          </Link>
          <Link className="btn btn--ghost" to={recipePath(meal.recipeId, "notes")} state={FROM_HOME}>
            Notes
          </Link>
        </div>
      ) : null}
    </li>
  );
}
