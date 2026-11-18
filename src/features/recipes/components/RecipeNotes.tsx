import { useState } from "react";
import { MAX_NOTE_LENGTH } from "../constants";
import { useRecipeNoteActions, useRecipeNotes } from "../queries";
import RecipeNoteItem from "./RecipeNoteItem";

type RecipeNotesProps = {
  recipeId: string;
};

/**
 * A recipe's notes, below the instructions: a box to add one, then every
 * note, newest first ("Nov 3, 2026: doubled the garlic"). Only the recipe's
 * owner sees them.
 */
export default function RecipeNotes({ recipeId }: RecipeNotesProps) {
  const { notes, loading, error } = useRecipeNotes(recipeId);
  const actions = useRecipeNoteActions(recipeId);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    setAdding(true);
    setAddError(null);
    try {
      await actions.add(draft);
      setDraft("");
    } catch (saveError) {
      setAddError(saveError instanceof Error && saveError.message ? saveError.message : "Couldn't save the note.");
    } finally {
      setAdding(false);
    }
  };

  return (
    <section className="workspace-card recipe-notes" aria-labelledby="recipe-notes-heading">
      <h2 id="recipe-notes-heading">Notes</h2>

      <form className="recipe-notes__form" onSubmit={handleAdd}>
        <textarea
          aria-label="New note"
          placeholder="How did it go? What would you change next time?"
          value={draft}
          maxLength={MAX_NOTE_LENGTH}
          rows={3}
          onChange={(event) => setDraft(event.target.value)}
          disabled={adding}
        />
        <div className="recipe-notes__actions">
          <button type="submit" className="btn btn--primary" disabled={adding || !draft.trim()}>
            {adding ? "Adding…" : "Add note"}
          </button>
        </div>
        {addError ? <p className="error">{addError}</p> : null}
      </form>

      {error ? (
        <p className="error">{error}</p>
      ) : loading ? (
        <p className="recipe-notes__empty">Loading notes…</p>
      ) : notes.length === 0 ? (
        <p className="recipe-notes__empty">No notes yet. Add one after you cook this.</p>
      ) : (
        <ul className="recipe-notes__list">
          {notes.map((note) => (
            <RecipeNoteItem
              key={note.id}
              note={note}
              onSave={(body) => actions.edit(note.id, body)}
              onDelete={() => actions.remove(note.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
