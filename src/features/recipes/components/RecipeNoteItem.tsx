import { useEffect, useRef, useState } from "react";
import { formatTimestampDate } from "../../../lib/utils/dates";
import type { RecipeNote } from "../types";
import NoteTextarea from "./NoteTextarea";

type RecipeNoteItemProps = {
  note: RecipeNote;
  /** Just added: briefly highlighted. */
  isNew?: boolean;
  onSave: (body: string) => Promise<void>;
  onDelete: () => Promise<void>;
};

type Mode = "view" | "edit" | "confirm-delete";

const errorText = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);

/**
 * One note: its date, text, and small Edit / Delete actions. Editing happens
 * in place (Ctrl/⌘ + Enter saves, Esc cancels); delete asks first. Focus
 * returns to Edit after editing, so keyboard use stays in place.
 */
export default function RecipeNoteItem({ note, isNew = false, onSave, onDelete }: RecipeNoteItemProps) {
  const [mode, setMode] = useState<Mode>("view");
  const [draft, setDraft] = useState(note.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);

  useEffect(() => {
    if (mode === "view" && returnFocus.current) {
      returnFocus.current = false;
      editButtonRef.current?.focus();
    }
    // The safe choice is focused when asked to confirm a delete.
    if (mode === "confirm-delete") cancelDeleteRef.current?.focus();
  }, [mode]);

  // Edited when saved again at least a minute after it was written.
  const edited = new Date(note.updatedAt).getTime() - new Date(note.createdAt).getTime() > 60_000;

  const backToView = () => {
    returnFocus.current = true;
    setError(null);
    setMode("view");
  };

  const cancelEdit = () => {
    setDraft(note.body);
    backToView();
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSave(draft);
      backToView();
    } catch (saveError) {
      setError(errorText(saveError, "Couldn't save the note."));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await onDelete();
    } catch (deleteError) {
      setError(errorText(deleteError, "Couldn't delete the note."));
      setBusy(false);
    }
  };

  const className = [
    "recipe-notes__item",
    isNew ? "recipe-notes__item--new" : "",
    busy ? "recipe-notes__item--busy" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li className={className}>
      <div className="recipe-notes__item-header">
        <p className="recipe-notes__date">
          {formatTimestampDate(note.createdAt)}
          {edited ? <span className="recipe-notes__edited"> · edited</span> : null}
        </p>
        {mode === "view" ? (
          <div className="recipe-notes__item-actions">
            <button
              ref={editButtonRef}
              type="button"
              className="recipe-notes__action"
              onClick={() => {
                setDraft(note.body);
                setError(null);
                setMode("edit");
              }}
            >
              Edit
            </button>
            <button
              type="button"
              className="recipe-notes__action recipe-notes__action--danger"
              onClick={() => {
                setError(null);
                setMode("confirm-delete");
              }}
            >
              Delete
            </button>
          </div>
        ) : null}
      </div>

      {mode === "edit" ? (
        <form
          className="recipe-notes__form"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <NoteTextarea
            label="Edit note"
            value={draft}
            onChange={setDraft}
            busy={busy}
            autoFocus
            onEscape={cancelEdit}
          />
          <div className="recipe-notes__actions">
            <button type="button" className="btn btn--ghost btn--small" onClick={cancelEdit} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary btn--small" disabled={busy || !draft.trim()}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      ) : (
        <p className="recipe-notes__body">{note.body}</p>
      )}

      {mode === "confirm-delete" ? (
        <div className="recipe-notes__confirm" role="group" aria-label="Confirm delete">
          <span className="recipe-notes__confirm-label">Delete this note?</span>
          <button
            ref={cancelDeleteRef}
            type="button"
            className="btn btn--ghost btn--small"
            onClick={backToView}
            disabled={busy}
          >
            Cancel
          </button>
          <button type="button" className="btn btn--danger btn--small" onClick={() => void remove()} disabled={busy}>
            {busy ? "Deleting…" : "Confirm delete"}
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </li>
  );
}
