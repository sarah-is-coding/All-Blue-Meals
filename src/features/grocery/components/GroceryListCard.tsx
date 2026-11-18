import { useState } from "react";
import type { GroceryItem, GroceryItemDraft } from "../types";
import GroceryItemGroups from "./GroceryItemGroups";

type Props = {
  /** The freshly built items. */
  items: GroceryItemDraft[];
  /** The dates or plan name, for the title ("Grocery List · …"). */
  sourceLabel: string;
};

/** A generated checklist with checkmarks kept on the page. */
export default function GroceryListCard({ items, sourceLabel }: Props) {
  // Ticks, by item index.
  const [checked, setChecked] = useState(new Set<number>());

  const displayItems: GroceryItem[] = items.map((item, idx) => ({
    id: String(idx),
    ...item,
    isChecked: checked.has(idx),
  }));
  const checkedCount = checked.size;

  const handleToggle = (item: GroceryItem, isChecked: boolean) => {
    const idx = Number(item.id);
    setChecked((prev) => {
      const next = new Set(prev);
      if (isChecked) next.add(idx);
      else next.delete(idx);
      return next;
    });
  };

  return (
    <article className="workspace-card grocery-list">
      <div className="grocery-list__title-group">
        <h2 className="grocery-list__title">{`Grocery List · ${sourceLabel}`}</h2>
        {displayItems.length > 0 && (
          <span className="grocery-list__count">
            {checkedCount}/{displayItems.length} checked
          </span>
        )}
      </div>

      {displayItems.length === 0 ? (
        <p className="grocery-list__empty">
          No ingredients found for this plan. Make sure your recipes have ingredients added.
        </p>
      ) : (
        <GroceryItemGroups items={displayItems} onToggle={handleToggle} />
      )}
    </article>
  );
}
