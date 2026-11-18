import { useState } from "react";
import { RECIPE_VIEWS } from "../constants";
import type { RecipeListView } from "../types";

type RecipeViewMenuProps = {
  view: RecipeListView;
  onChange: (view: RecipeListView) => void;
};

/** "View: List ▾", a dropdown like Add Recipe's, to switch how recipes are shown. */
export default function RecipeViewMenu({ view, onChange }: RecipeViewMenuProps) {
  const [open, setOpen] = useState(false);
  const current = RECIPE_VIEWS.find((option) => option.value === view) ?? RECIPE_VIEWS[0]!;

  return (
    <div className="recipe-add-menu recipe-view-menu">
      <button
        type="button"
        className="btn btn--ghost"
        onClick={() => setOpen((isOpen) => !isOpen)}
        aria-expanded={open}
        aria-controls="recipe-view-menu"
        aria-haspopup="menu"
        aria-label={`View: ${current.label}`}
      >
        {/* The prefix is dropped on phones so the toolbar fits on one line. */}
        <span className="recipe-view-menu__prefix">View: </span>
        {current.label} <span aria-hidden="true">▾</span>
      </button>
      {open ? (
        <div id="recipe-view-menu" className="recipe-add-menu__panel" role="menu" aria-label="Recipe view">
          {RECIPE_VIEWS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={option.value === view}
              className={[
                "recipe-add-menu__item",
                option.value === view ? "recipe-view-menu__item--current" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => {
                setOpen(false);
                if (option.value !== view) onChange(option.value);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
