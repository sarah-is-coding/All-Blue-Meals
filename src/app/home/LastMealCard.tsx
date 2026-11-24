import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { PlannedMeal } from "../../features/meal-plans/types";
import NoteTextarea from "../../features/recipes/components/NoteTextarea";
import StarRating from "../../features/recipes/components/StarRating";
import { useRecipe, useRecipeActions, useRecipeNoteActions } from "../../features/recipes/queries";
import { recipePath } from "../../features/recipes/utils/recipePaths";
import { lastMealWhen } from "./homeMeals";

// "Note added" fades out by itself after this long.
const NOTE_ADDED_MS = 4000;

const errorText = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

/**
 * The last meal planned before today, to rate it and jot a note while it's
 * fresh ("needed more salt"), with links to the recipe and its notes.
 */
export default function LastMealCard({ meal, todayIso }: { meal: PlannedMeal; todayIso: string }) {
  const recipeId = meal.recipeId ?? "";
  const { recipe } = useRecipe(meal.recipeId);
  const recipeActions = useRecipeActions();
  const noteActions = useRecipeNoteActions(recipeId);
  const [savingRating, setSavingRating] = useState(false);
  const [draft, setDraft] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [noteAdded, setNoteAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!noteAdded) return;
    const timer = window.setTimeout(() => setNoteAdded(false), NOTE_ADDED_MS);
    return () => window.clearTimeout(timer);
  }, [noteAdded]);

  const handleRate = async (rating: number | null) => {
    setSavingRating(true);
    setError(null);
    try {
      await recipeActions.rate(recipeId, rating);
    } catch (rateError) {
      setError(errorText(rateError, "Couldn't save the rating."));
    } finally {
      setSavingRating(false);
    }
  };

  const handleAddNote = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.trim() || addingNote) return;
    setAddingNote(true);
    setError(null);
    try {
      await noteActions.add(draft);
      setDraft("");
      setNoteAdded(true);
    } catch (noteError) {
      setError(errorText(noteError, "Couldn't save the note."));
    } finally {
      setAddingNote(false);
    }
  };

  return (
    <div className="home-last-meal">
      <p className="home-meal__type">{lastMealWhen(meal, todayIso)}</p>
      <h3 className="home-meal__title">
        <Link to={recipePath(recipeId)} state={{ from: "home" }}>{meal.recipeTitle}</Link>
      </h3>

      <div className="home-last-meal__rating">
        <span>How was it?</span>
        <StarRating
          value={recipe?.rating ?? null}
          onChange={(rating) => void handleRate(rating)}
          disabled={savingRating || !recipe}
          label={`Rate ${meal.recipeTitle}`}
        />
      </div>

      <form className="home-last-meal__note" onSubmit={handleAddNote}>
        <NoteTextarea
          label={`Note on ${meal.recipeTitle}`}
          placeholder="Anything to remember for next time?"
          value={draft}
          onChange={(value) => {
            setDraft(value);
            setNoteAdded(false);
          }}
          busy={addingNote}
          submitVerb="add"
        />
        <div className="home-meal__links">
          <button type="submit" className="btn btn--primary btn--small" disabled={addingNote || !draft.trim()}>
            {addingNote ? "Adding…" : "Add note"}
          </button>
          <Link className="btn btn--ghost btn--small" to={recipePath(recipeId, "notes")} state={{ from: "home" }}>
            See all notes
          </Link>
          <Link className="btn btn--ghost btn--small" to={recipePath(recipeId)} state={{ from: "home" }}>
            Open recipe
          </Link>
        </div>
      </form>

      {noteAdded ? (
        <p className="message home-last-meal__added" role="status">
          Note added.
        </p>
      ) : null}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
