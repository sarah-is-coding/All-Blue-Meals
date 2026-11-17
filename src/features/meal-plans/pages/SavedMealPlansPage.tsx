import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { formatDateRange } from "../../../lib/utils/dates";
import { useSavedMealPlanActions, useSavedMealPlans } from "../queries";
import type { SavedMealPlan } from "../types";

type EditState = { id: string; value: string } | null;
type ConfirmDeleteId = string | null;

export default function SavedMealPlansPage() {
  const { plans, loading, error: loadError } = useSavedMealPlans();
  const actions = useSavedMealPlanActions();

  const [editState, setEditState] = useState<EditState>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const [confirmDeleteId, setConfirmDeleteId] = useState<ConfirmDeleteId>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editState) editInputRef.current?.focus();
  }, [editState]);

  const startRename = (plan: SavedMealPlan) => {
    setEditState({ id: plan.id, value: plan.savedName });
    setRenameError(null);
  };

  const commitRename = () => {
    if (!editState || !editState.value.trim()) return;
    setRenaming(true);
    setRenameError(null);
    actions
      .rename(editState.id, editState.value.trim())
      .then(() => setEditState(null))
      .catch((e) => setRenameError(e instanceof Error ? e.message : "Failed to rename."))
      .finally(() => setRenaming(false));
  };

  const cancelRename = () => {
    setEditState(null);
    setRenameError(null);
  };

  const handleDelete = (id: string) => {
    setDeleting(true);
    setDeleteError(null);
    // Deletes only the saved copy; meals on the calendar stay.
    actions
      .remove(id)
      .then(() => setConfirmDeleteId(null))
      .catch((e) => setDeleteError(e instanceof Error ? e.message : "Failed to delete plan."))
      .finally(() => setDeleting(false));
  };

  return (
    <section className="workspace-route saved-plans-route">
      <div className="saved-plans-header">
        <Link to="/app/meal-plans" className="saved-plans-back">
          ← Meal Plans
        </Link>
        <h1 className="saved-plans-title">Saved Meal Plans</h1>
      </div>

      {loadError && <p className="error">{loadError}</p>}
      {loading && <p className="saved-plans-empty">Loading…</p>}

      {!loading && plans.length === 0 && !loadError && (
        <div className="saved-plans-empty">
          <p>You haven't saved any meal plans yet.</p>
          <p className="saved-plans-empty__hint">
            Open the <strong>Meal Plans</strong> page, browse a past week, and click{" "}
            <em>Save as Meal Plan…</em> to bookmark it here.
          </p>
        </div>
      )}

      {plans.length > 0 && (
        <>
          {deleteError && <p className="error">{deleteError}</p>}
          <ul className="saved-plans-list">
            {plans.map((plan) => {
              const isEditing = editState?.id === plan.id;
              const isConfirmingDelete = confirmDeleteId === plan.id;

              return (
                <li key={plan.id} className="saved-plans-list__item workspace-card">
                  <div className="saved-plans-list__main">
                    {isEditing ? (
                      <div className="saved-plans-list__rename">
                        <input
                          ref={editInputRef}
                          type="text"
                          className="saved-plans-list__rename-input"
                          value={editState.value}
                          maxLength={80}
                          onChange={(e) => setEditState({ id: plan.id, value: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitRename();
                            if (e.key === "Escape") cancelRename();
                          }}
                        />
                        <div className="saved-plans-list__rename-actions">
                          <button
                            type="button"
                            className="btn btn--ghost"
                            onClick={cancelRename}
                            disabled={renaming}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="btn btn--primary"
                            onClick={commitRename}
                            disabled={renaming || !editState.value.trim()}
                          >
                            {renaming ? "Saving…" : "Save"}
                          </button>
                        </div>
                        {renameError && <p className="error">{renameError}</p>}
                      </div>
                    ) : (
                      <>
                        <span className="saved-plans-list__name">{plan.savedName}</span>
                        <span className="saved-plans-list__range">
                          {formatDateRange(plan.startDate, plan.endDate)}
                        </span>
                      </>
                    )}
                  </div>

                  {!isEditing && (
                    <div className="saved-plans-list__actions">
                      {isConfirmingDelete ? (
                        <>
                          <span className="saved-plans-list__confirm-label">Delete?</span>
                          <button
                            type="button"
                            className="btn btn--ghost"
                            onClick={() => setConfirmDeleteId(null)}
                            disabled={deleting}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="btn btn--danger"
                            onClick={() => handleDelete(plan.id)}
                            disabled={deleting}
                          >
                            {deleting ? "Deleting…" : "Confirm delete"}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn btn--ghost"
                            onClick={() => startRename(plan)}
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            className="btn btn--ghost btn--danger-ghost"
                            onClick={() => {
                              setConfirmDeleteId(plan.id);
                              setDeleteError(null);
                            }}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
