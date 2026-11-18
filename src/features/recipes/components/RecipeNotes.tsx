import { useEffect, useRef, useState } from "react";
import { RECIPE_NOTES_ANCHOR } from "../constants";
import { useRecipeNoteActions, useRecipeNotes } from "../queries";
import NoteTextarea from "./NoteTextarea";
import RecipeNoteItem from "./RecipeNoteItem";

type RecipeNotesProps = {
  recipeId: string;
};

// How long a just-added note stays highlighted.
const NEW_NOTE_HIGHLIGHT_MS = 2500;

/**
 * A recipe's notes, below the instructions: a box to add one, then every
 * note, newest first ("Nov 3, 2026: doubled the garlic"). Only the recipe's
 * owner sees them. Links to "#notes" (e.g. from the home page) scroll here.
 */
export default function RecipeNotes({ recipeId }: RecipeNotesProps) {
  const { notes, loading, error } = useRecipeNotes(recipeId);
  const actions = useRecipeNoteActions(recipeId);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [newNoteId, setNewNoteId] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  // Once the notes have loaded (so the page has its final height), bring the
  // section into view when the link asked for it.
  useEffect(() => {
    if (loading || window.location.hash !== `#${RECIPE_NOTES_ANCHOR}`) return;
    sectionRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [loading]);

  // A just-added note is highlighted for a moment, then settles in.
  useEffect(() => {
    if (!newNoteId) return;
    const timer = window.setTimeout(() => setNewNoteId(null), NEW_NOTE_HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [newNoteId]);

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.trim() || adding) return;
    setAdding(true);
    setAddError(null);
    try {
      const note = await actions.add(draft);
      setDraft("");
      setNewNoteId(note.id);
    } catch (saveError) {
      setAddError(saveError instanceof Error && saveError.message ? saveError.message : "Couldn't save the note.");
    } finally {
      setAdding(false);
    }
  };

  return (
    <section
      ref={sectionRef}
      id={RECIPE_NOTES_ANCHOR}
      className="workspace-card recipe-notes"
      aria-labelledby="recipe-notes-heading"
    >
      <h2 id="recipe-notes-heading">
        Notes
        {notes.length > 0 ? <span className="recipe-notes__count">{notes.length}</span> : null}
      </h2>

      <form className="recipe-notes__form recipe-notes__form--new" onSubmit={handleAdd}>
        <NoteTextarea
          label="New note"
          placeholder="How did it go? What would you change next time?"
          value={draft}
          onChange={(value) => {
            setDraft(value);
            if (addError) setAddError(null);
          }}
          busy={adding}
          submitVerb="add"
        />
        <div className="recipe-notes__actions">
          <button type="submit" className="btn btn--primary btn--small" disabled={adding || !draft.trim()}>
            {adding ? "Adding…" : "Add note"}
          </button>
        </div>
        {addError ? (
          <p className="error" role="alert">
            {addError}
          </p>
        ) : null}
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
              isNew={note.id === newNoteId}
              onSave={(body) => actions.edit(note.id, body)}
              onDelete={() => actions.remove(note.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
