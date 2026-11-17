import type { GroceryItem } from "../types";
import { groupItemsByCategory } from "../utils/groceryGeneration";

type Props = {
  items: GroceryItem[];
  onToggle: (item: GroceryItem, isChecked: boolean) => void;
  /** The item whose change is still saving; its checkbox is disabled until then. */
  savingItemId?: string | null;
};

/** A grocery checklist grouped by ingredient category. */
export default function GroceryItemGroups({ items, onToggle, savingItemId = null }: Props) {
  return (
    <div className="grocery-item-groups">
      {groupItemsByCategory(items).map((group) => (
        <div key={group.label} className="grocery-category">
          <h3 className="grocery-category__header">{group.label}</h3>
          <ul className="grocery-item-list" aria-label={`${group.label} items`}>
            {group.items.map((item) => (
              <li
                key={item.id}
                className={`grocery-item${item.isChecked ? " grocery-item--checked" : ""}`}
              >
                <label className="grocery-item__label">
                  <input
                    type="checkbox"
                    className="grocery-item__checkbox"
                    checked={item.isChecked}
                    disabled={savingItemId === item.id}
                    onChange={(e) => onToggle(item, e.target.checked)}
                  />
                  <span className="grocery-item__name">{item.ingredientName}</span>
                  {(item.quantity || item.unit) && (
                    <span className="grocery-item__amount">
                      {[item.quantity, item.unit].filter(Boolean).join(" ")}
                    </span>
                  )}
                </label>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
