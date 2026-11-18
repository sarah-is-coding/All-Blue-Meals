import { INGREDIENT_CATEGORIES, type IngredientCategory } from "../../ingredients/types";

type IngredientCategoryPickerProps = {
  /** The new ingredient's name, as typed. */
  name: string;
  /** Highlighted pill (keyboard or hover), or -1. */
  activeIndex: number;
  creating: boolean;
  onActiveIndexChange: (index: number) => void;
  onPick: (category: IngredientCategory) => void;
  onBack: () => void;
};

/** Second step of "Add new" in IngredientNameCombobox: choose the category. */
export default function IngredientCategoryPicker({
  name,
  activeIndex,
  creating,
  onActiveIndexChange,
  onPick,
  onBack,
}: IngredientCategoryPickerProps) {
  return (
    <div className="ingredient-combobox__dropdown ingredient-combobox__categorize">
      <div className="ingredient-combobox__categorize-header">
        <button type="button" className="ingredient-combobox__back" onMouseDown={onBack}>
          ← back
        </button>
        <span className="ingredient-combobox__categorize-label">{`Pick a category for "${name}"`}</span>
      </div>
      <div className="ingredient-combobox__category-pills" role="listbox">
        {INGREDIENT_CATEGORIES.map((category, index) => (
          <button
            key={category}
            type="button"
            role="option"
            aria-selected={activeIndex === index}
            disabled={creating}
            className={[
              "ingredient-combobox__pill",
              activeIndex === index ? "ingredient-combobox__pill--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onMouseDown={() => onPick(category)}
            onMouseEnter={() => onActiveIndexChange(index)}
          >
            {creating && activeIndex === index ? "Adding…" : category}
          </button>
        ))}
      </div>
    </div>
  );
}
