import { useState } from "react";
import { formatTimestampDate } from "../../../lib/utils/dates";
import { MAX_NOTE_LENGTH } from "../constants";
import type { RecipeNote } from "../types";

type RecipeNoteItemProps = {
  note: RecipeNote;
  onSave: (body: string) => Promise<void>;
  onDelete: () => Promise<void>;
};

const errorText = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);

/** One note: its date and text, with inline edit and a confirmed delete. */
export default function RecipeNoteItem({ note, onSave, onDelete }: RecipeNoteItemProps) {
  const [mode, setMode] = useState<"view" | "edit" | "confirm-delete">("view");
  const [draft, setDraft] = useState(note.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edited when saved again at least a minute after it was written.
  const edited = new Date(note.updatedAt).getTime() - new Date(note.createdAt).getTime() > 60_000;

  const run = async (action: () => Promise<void>, fallback: string, after?: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      after?.();
    } catch (actionError) {
      setError(errorText(actionError, fallback));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="recipe-notes__item">
      <p className="recipe-notes__date">
        {formatTimestampDate(note.createdAt)}
        {edited ? <span className="recipe-notes__edited"> · edited</span> : null}
      </p>

      {mode === "edit" ? (
        <form
          className="recipe-notes__form"
          onSubmit={(event) => {
            event.preventDefault();
            void run(() => onSave(draft), "Couldn't save the note.", () => setMode("view"));
          }}
        >
          <textarea
            aria-label="Edit note"
            value={draft}
            maxLength={MAX_NOTE_LENGTH}
            rows={3}
            onChange={(event) => setDraft(event.target.value)}
            disabled={busy}
          />
          <div className="recipe-notes__actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setDraft(note.body);
                setError(null);
                setMode("view");
              }}
              disabled={busy}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={busy || !draft.trim()}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      ) : (
        <p className="recipe-notes__body">{note.body}</p>
      )}

      {mode === "view" ? (
        <div className="recipe-notes__actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              setDraft(note.body);
              setMode("edit");
            }}
          >
            Edit
          </button>
          <button type="button" className="btn btn--ghost btn--danger-ghost" onClick={() => setMode("confirm-delete")}>
            Delete
          </button>
        </div>
      ) : null}

      {mode === "confirm-delete" ? (
        <div className="recipe-notes__actions">
          <span className="recipe-notes__confirm-label">Delete this note?</span>
          <button type="button" className="btn btn--ghost" onClick={() => setMode("view")} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--danger"
            onClick={() => void run(onDelete, "Couldn't delete the note.")}
            disabled={busy}
          >
            {busy ? "Deleting…" : "Confirm delete"}
          </button>
        </div>
      ) : null}

      {error ? <p className="error">{error}</p> : null}
    </li>
  );
}
