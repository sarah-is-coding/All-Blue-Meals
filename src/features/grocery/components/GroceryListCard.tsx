import { useState } from "react";
import { Link } from "react-router-dom";
import SaveNameForm from "../../../components/forms/SaveNameForm";
import { useGroceryListActions } from "../queries";
import type { GroceryItem, GroceryItemDraft, GroceryList, GroceryListOrigin } from "../types";
import GroceryItemGroups from "./GroceryItemGroups";

type Props = {
  /** The freshly built items. */
  items: GroceryItemDraft[];
  /** What the items were built from, saved with the list. */
  origin: GroceryListOrigin;
  /** The dates or plan name, for the title ("Grocery List · …"). */
  sourceLabel: string;
};

/**
 * A just-built grocery list: tick items off, and save it. Before saving, ticks
 * live only here; once saved, they're saved with the list.
 */
export default function GroceryListCard({ items, origin, sourceLabel }: Props) {
  const groceryActions = useGroceryListActions();
  // Ticks on the unsaved list, by item index.
  const [localChecked, setLocalChecked] = useState(new Set<number>());
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [savedList, setSavedList] = useState<GroceryList | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  // An unsaved list's items are keyed by their index (see handleToggle).
  const displayItems: GroceryItem[] = savedList
    ? savedList.items
    : items.map((item, idx) => ({ id: String(idx), ...item, isChecked: localChecked.has(idx) }));
  const checkedCount = displayItems.filter((i) => i.isChecked).length;

  // The form shows save errors itself.
  const handleSave = async (title: string) => {
    const list = await groceryActions.save(title, origin, items);
    setSavedList(list);
    setShowSaveForm(false);
  };

  const toggleSavedItem = async (list: GroceryList, itemId: string, isChecked: boolean) => {
    setTogglingId(itemId);
    setToggleError(null);
    try {
      await groceryActions.toggleItem(list.id, itemId, isChecked);
      setSavedList((prev) =>
        prev && {
          ...prev,
          items: prev.items.map((item) => (item.id === itemId ? { ...item, isChecked } : item)),
        }
      );
    } catch (e) {
      setToggleError(e instanceof Error ? e.message : "Failed to update item.");
    } finally {
      setTogglingId((id) => (id === itemId ? null : id));
    }
  };

  const handleToggle = (item: GroceryItem, isChecked: boolean) => {
    if (savedList) {
      void toggleSavedItem(savedList, item.id, isChecked);
      return;
    }
    const idx = Number(item.id);
    setLocalChecked((prev) => {
      const next = new Set(prev);
      if (isChecked) next.add(idx);
      else next.delete(idx);
      return next;
    });
  };

  return (
    <article className="workspace-card grocery-list">
      <div className="grocery-list__header">
        <div className="grocery-list__title-group">
          <h2 className="grocery-list__title">
            {savedList ? savedList.title : `Grocery List · ${sourceLabel}`}
          </h2>
          {displayItems.length > 0 && (
            <span className="grocery-list__count">
              {checkedCount}/{displayItems.length} checked
            </span>
          )}
        </div>

        <div className="grocery-list__actions">
          {!savedList && items.length > 0 && !showSaveForm && (
            <button type="button" className="btn btn--ghost" onClick={() => setShowSaveForm(true)}>
              Save list…
            </button>
          )}
          {savedList && (
            <Link to="/app/saved-grocery-lists" className="btn btn--ghost">
              Manage saved lists
            </Link>
          )}
        </div>
      </div>

      {showSaveForm && (
        <SaveNameForm
          className="grocery-save-form"
          placeholder="List name"
          initialName={`Grocery – ${sourceLabel}`}
          onSave={handleSave}
          onCancel={() => setShowSaveForm(false)}
          errorFallback="Failed to save grocery list."
        />
      )}

      {savedList && (
        <p className="grocery-list__saved-badge">
          ✓ Saved — you can find this list under{" "}
          <Link to="/app/saved-grocery-lists" className="grocery-list__saved-link">
            Manage saved lists
          </Link>
          .
        </p>
      )}

      {toggleError && <p className="error">{toggleError}</p>}

      {displayItems.length === 0 ? (
        <p className="grocery-list__empty">
          No ingredients found for this plan. Make sure your recipes have ingredients added.
        </p>
      ) : (
        <GroceryItemGroups items={displayItems} onToggle={handleToggle} savingItemId={togglingId} />
      )}
    </article>
  );
}
