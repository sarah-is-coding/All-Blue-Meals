import { Link } from "react-router-dom";
import { MEAL_TYPE_OPTIONS } from "../../features/meal-plans/constants";
import type { PlannedMeal } from "../../features/meal-plans/types";
import { useRecipe, useRecipeNotes } from "../../features/recipes/queries";
import { meatsIn } from "../../features/recipes/utils/recipeMeats";
import { recipePath } from "../../features/recipes/utils/recipePaths";
import { previewTags } from "../../features/recipes/utils/recipeTags";
import { formatTimestampDate } from "../../lib/utils/dates";

// Tags shown on the card; the rest are counted ("+2 more").
const MAX_TAGS = 3;

const mealTypeLabel = (meal: PlannedMeal) =>
  MEAL_TYPE_OPTIONS.find((option) => option.value === meal.mealType)?.label ?? meal.mealType;

/** "1 hr 15 min" from prep + cook minutes; null when neither is set. */
const totalTime = (prep: number | null, cook: number | null): string | null => {
  const minutes = (prep ?? 0) + (cook ?? 0);
  if (minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return [hours ? `${hours} hr` : "", rest ? `${rest} min` : ""].filter(Boolean).join(" ");
};

/**
 * Preview of a planned meal (today's or tomorrow's): what it is, how long it
 * takes, its tags (marinate first, so you know to start early), the meat or
 * seafood it uses (so you know what to thaw or buy), and its latest note.
 */
export default function MealPreviewCard({ meal }: { meal: PlannedMeal }) {
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
      <p className="home-meal__type">{mealTypeLabel(meal)}</p>
      <h3 className="home-meal__title">
        {meal.recipeId ? <Link to={recipePath(meal.recipeId)}>{meal.recipeTitle}</Link> : meal.recipeTitle}
      </h3>

      {servings || time ? (
        <p className="home-meal__facts">
          {[servings ? `Serves ${servings}` : "", time ?? ""].filter(Boolean).join(" · ")}
        </p>
      ) : null}

      {tags.shown.length > 0 ? (
        <div className="home-meal__tags">
          {tags.shown.map((tag) => (
            <span key={tag} className="recipe-tag">
              {tag}
            </span>
          ))}
          {tags.hiddenCount > 0 ? <span className="home-meal__tags-more">+{tags.hiddenCount} more</span> : null}
        </div>
      ) : null}

      {recipe?.description ? <p className="home-meal__description">{recipe.description}</p> : null}

      {loading ? (
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

      {meal.recipeId ? (
        <div className="home-meal__links">
          <Link className="btn btn--primary" to={recipePath(meal.recipeId)}>
            Open recipe
          </Link>
          <Link className="btn btn--ghost" to={recipePath(meal.recipeId, "notes")}>
            Notes
          </Link>
        </div>
      ) : null}
    </li>
  );
}
