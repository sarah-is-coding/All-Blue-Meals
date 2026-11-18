import { useState, type ReactNode } from "react";

type RecipeDeleteControlsProps = {
  /** Deletes the recipe; resolves after it's gone (the page navigates away). */
  onDelete: () => Promise<void>;
  /** Called with a message when deleting fails, or null when starting over. */
  onError: (message: string | null) => void;
  /** Shown next to "Delete" while not confirming (the Edit button). */
  otherActions?: ReactNode;
};

/** "Delete" → "Delete this recipe? Cancel / Confirm delete". */
export default function RecipeDeleteControls({ onDelete, onError, otherActions }: RecipeDeleteControlsProps) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    setDeleting(true);
    onError(null);
    try {
      await onDelete();
    } catch (deleteError) {
      onError(deleteError instanceof Error ? deleteError.message : "Failed to delete recipe.");
      setDeleting(false);
    }
  };

  if (confirming) {
    return (
      <>
        <span className="recipe-page-header__confirm-label">Delete this recipe?</span>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => setConfirming(false)}
          disabled={deleting}
        >
          Cancel
        </button>
        <button type="button" className="btn btn--danger" onClick={handleConfirm} disabled={deleting}>
          {deleting ? "Deleting…" : "Confirm delete"}
        </button>
      </>
    );
  }

  return (
    <>
      {otherActions}
      <button
        type="button"
        className="btn btn--ghost btn--danger-ghost"
        onClick={() => {
          setConfirming(true);
          onError(null);
        }}
      >
        Delete
      </button>
    </>
  );
}
