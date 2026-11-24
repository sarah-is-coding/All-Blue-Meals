import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  useCreateIngredient,
  useIngredientCategories,
  useIngredientSearch,
} from "../../ingredients/queries";
import type { Ingredient, IngredientCategory } from "../../ingredients/types";
import { ingredientKey } from "../../ingredients/utils/ingredientKey";
import { useDebouncedValue } from "../../../lib/hooks/useDebouncedValue";
import IngredientCategoryPicker from "./IngredientCategoryPicker";

type Phase = "search" | "categorize";

/** How long typing pauses before the catalog is searched. */
const SEARCH_DEBOUNCE_MS = 280;

type Props = {
  value: string;
  onSelect: (ingredientId: string, name: string) => void;
  readOnly?: boolean;
  /** The field's accessible name (e.g. "Ingredient", "Substitute"), since
   *  the compact ingredient rows have no visible label. */
  label?: string;
};

export default function IngredientNameCombobox({
  value,
  onSelect,
  readOnly = false,
  label = "Ingredient",
}: Props) {
  const categories = useIngredientCategories();
  const categoryLabel = (code: IngredientCategory) =>
    categories.find((category) => category.code === code)?.name ?? code;
  const [query, setQuery] = useState(value);
  const [phase, setPhase] = useState<Phase>("search");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { create, creating } = useCreateIngredient();

  // When the parent resets the field, show its value. Adjusted while
  // rendering rather than in an effect, so the old text never flashes.
  const [shownValue, setShownValue] = useState(value);
  if (value !== shownValue) {
    setShownValue(value);
    setQuery(value);
  }

  // Search a moment after typing stops, only while the list is open in the
  // search phase. Results belong to the term they were fetched for, so a
  // slow earlier search can't replace a later one.
  const typed = query.trim();
  const debouncedTyped = useDebouncedValue(typed, SEARCH_DEBOUNCE_MS);
  const searching = isOpen && phase === "search" && typed !== "";
  const { suggestions, loading } = useIngredientSearch(searching ? debouncedTyped : "");

  const closeAndReset = () => {
    setIsOpen(false);
    setPhase("search");
    setQuery(value);
    setActiveIndex(-1);
  };

  // Close and reset when clicking outside.
  //
  // Important: we check document.contains(target) first. When the user
  // clicks the "Add new" option, React re-renders synchronously in real
  // browsers, which unmounts the <li> from the DOM before this handler fires
  // at the document level. At that point event.target is a detached node,
  // so containerRef.current.contains() returns false even though the click
  // was inside the combobox. Ignoring detached targets fixes this.
  //
  // An effect event, so the listener is added once but always resets to the
  // latest `value`.
  const onDocumentMouseDown = useEffectEvent((event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Node) || !document.contains(target)) return;
    if (containerRef.current && !containerRef.current.contains(target)) {
      closeAndReset();
    }
  });
  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => onDocumentMouseDown(event);
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  const commitExisting = (ingredient: Ingredient) => {
    onSelect(ingredient.id, ingredient.name);
    setQuery(ingredient.name);
    setIsOpen(false);
    setPhase("search");
    setActiveIndex(-1);
  };

  const commitNew = async (category: IngredientCategory) => {
    if (!typed || creating) return;
    try {
      const created = await create({ name: typed, category });
      onSelect(created.id, created.name);
      setQuery(created.name);
      setIsOpen(false);
      setPhase("search");
      setActiveIndex(-1);
    } catch {
      // leave open so the user can try again
    }
  };

  const enterCategorizePhase = () => {
    setPhase("categorize");
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
    setPhase("search");
    setIsOpen(true);
    setActiveIndex(-1);
  };

  // "Add new" is hidden when the text already names a suggestion by key or
  // alias ("Onions" when onion exists, "scallions" when it's an alias), so
  // the same ingredient isn't offered twice.
  const queryKey = ingredientKey(query);
  const matchesExisting = suggestions.some(
    (match) =>
      ingredientKey(match.name) === queryKey ||
      (match.matchedAlias !== null && ingredientKey(match.matchedAlias) === queryKey)
  );
  const showAddNew = queryKey.length > 0 && !matchesExisting;

  // Keyboard nav — search phase
  const totalSearchOptions = suggestions.length + (showAddNew ? 1 : 0);
  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, totalSearchOptions - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, -1));
        break;
      case "Enter":
        event.preventDefault();
        if (activeIndex >= 0 && activeIndex < suggestions.length) {
          commitExisting(suggestions[activeIndex]);
        } else if (showAddNew && activeIndex === suggestions.length) {
          enterCategorizePhase();
        }
        break;
      case "Escape":
        closeAndReset();
        break;
    }
  };

  // Keyboard nav — categorize phase
  const handleCategorizeKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((prev) =>
          prev <= 0 ? categories.length - 1 : prev - 1
        );
        break;
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((prev) =>
          prev >= categories.length - 1 ? 0 : prev + 1
        );
        break;
      case "Enter":
        event.preventDefault();
        if (activeIndex >= 0 && activeIndex < categories.length) {
          void commitNew(categories[activeIndex].code);
        }
        break;
      case "Escape":
        setPhase("search");
        setActiveIndex(-1);
        break;
    }
  };

  const showSearchDropdown = isOpen && phase === "search" && (suggestions.length > 0 || showAddNew);
  const showCategorizeDropdown = isOpen && phase === "categorize";

  if (readOnly) {
    return <input type="text" value={value} readOnly aria-label={label} />;
  }

  return (
    <div className="ingredient-combobox" ref={containerRef}>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label={label}
        aria-autocomplete="list"
        aria-expanded={showSearchDropdown || showCategorizeDropdown}
        value={query}
        onChange={handleInputChange}
        onKeyDown={phase === "search" ? handleSearchKeyDown : handleCategorizeKeyDown}
        placeholder="Search or add ingredient…"
        autoComplete="off"
      />

      {/* ── Phase 1: search results ──────────────────────────── */}
      {showSearchDropdown && (
        <ul className="ingredient-combobox__dropdown" role="listbox">
          {loading && suggestions.length === 0 && (
            <li className="ingredient-combobox__hint">Searching…</li>
          )}
          {suggestions.map((ingredient, idx) => (
            <li
              key={ingredient.id}
              role="option"
              aria-selected={activeIndex === idx}
              className={[
                "ingredient-combobox__option",
                activeIndex === idx ? "ingredient-combobox__option--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onMouseDown={() => commitExisting(ingredient)}
              onMouseEnter={() => setActiveIndex(idx)}
            >
              <span className="ingredient-combobox__name">
                {ingredient.name}
                {ingredient.matchedAlias && (
                  <span className="ingredient-combobox__alias">{` (${ingredient.matchedAlias})`}</span>
                )}
              </span>
              {ingredient.category && (
                <span className="ingredient-combobox__category">
                  {categoryLabel(ingredient.category)}
                </span>
              )}
            </li>
          ))}
          {showAddNew && (
            <li
              role="option"
              aria-selected={activeIndex === suggestions.length}
              className={[
                "ingredient-combobox__option",
                "ingredient-combobox__option--add",
                activeIndex === suggestions.length
                  ? "ingredient-combobox__option--active"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onMouseDown={enterCategorizePhase}
              onMouseEnter={() => setActiveIndex(suggestions.length)}
            >
              {`+ Add "${query.trim()}" as new ingredient`}
            </li>
          )}
        </ul>
      )}

      {/* ── Phase 2: category picker ─────────────────────────── */}
      {showCategorizeDropdown && (
        <IngredientCategoryPicker
          name={query.trim()}
          categories={categories}
          activeIndex={activeIndex}
          creating={creating}
          onActiveIndexChange={setActiveIndex}
          onPick={(category) => void commitNew(category)}
          onBack={() => {
            setPhase("search");
            setActiveIndex(-1);
          }}
        />
      )}
    </div>
  );
}
