import { useState } from "react";
import { useIngredientCategories } from "../../ingredients/queries";
import type { GroceryItem } from "../types";
import { groupItemsByCategory } from "../utils/groceryGeneration";

type Props = {
  items: GroceryItem[];
  onToggle: (item: GroceryItem, isChecked: boolean) => void;
  /** The item whose change is still saving; its checkbox is disabled until then. */
  savingItemId?: string | null;
};

/**
 * A grocery checklist grouped by ingredient category. An item with
 * substitutes has an "N options" toggle that shows them underneath
 * ("or avocado oil, 2 tbsp"); collapsed by default to keep the list short.
 */
export default function GroceryItemGroups({ items, onToggle, savingItemId = null }: Props) {
  const categories = useIngredientCategories();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (itemId: string) =>
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });

  return (
    <div className="grocery-item-groups">
      {groupItemsByCategory(items, categories).map((group) => (
        <div key={group.label} className="grocery-category">
          <h3 className="grocery-category__header">{group.label}</h3>
          <ul className="grocery-item-list" aria-label={`${group.label} items`}>
            {group.items.map((item) => {
              const optionCount = item.substitutes.length;
              const isExpanded = expanded.has(item.id);
              const optionsId = `grocery-item-options-${item.id}`;
              return (
                <li
                  key={item.id}
                  className={`grocery-item${item.isChecked ? " grocery-item--checked" : ""}`}
                >
                  <div className="grocery-item__row">
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
                    {optionCount > 0 ? (
                      <button
                        type="button"
                        className="grocery-item__options-toggle"
                        aria-expanded={isExpanded}
                        aria-controls={optionsId}
                        onClick={() => toggleExpanded(item.id)}
                      >
                        {optionCount === 1 ? "1 option" : `${optionCount} options`}
                      </button>
                    ) : null}
                  </div>
                  {optionCount > 0 && isExpanded ? (
                    <ul className="grocery-item__options" id={optionsId} aria-label={`Options for ${item.ingredientName}`}>
                      {item.substitutes.map((option) => (
                        <li key={option}>{`or ${option}`}</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
