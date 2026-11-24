import { useEffect, useRef, useState } from "react";
import { createIngredient, searchIngredients } from "../../ingredients/api";
import { useIngredientCategories } from "../../ingredients/queries";
import type { Ingredient, IngredientCategory, IngredientMatch } from "../../ingredients/types";
import { ingredientKey } from "../../ingredients/utils/ingredientKey";
import IngredientCategoryPicker from "./IngredientCategoryPicker";

type Phase = "search" | "categorize";

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
  const [suggestions, setSuggestions] = useState<IngredientMatch[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the displayed text in sync when the parent resets the field
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Debounced search — only runs in search phase
  useEffect(() => {
    if (phase !== "search") return;
    const trimmed = query.trim();
    if (!trimmed || !isOpen) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchIngredients(trimmed);
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [query, isOpen, phase]);

  // Close and reset when clicking outside.
  //
  // Important: we check document.contains(target) first. When the user
  // clicks the "Add new" option, React re-renders synchronously in real
  // browsers (React 18 flushes during native events), which unmounts the
  // <li> from the DOM before this handler fires at the document level.
  // At that point event.target is a detached node, so
  // containerRef.current.contains() returns false even though the click
  // was inside the combobox.  Ignoring detached targets fixes this.
  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!document.contains(target)) return;
      if (
        containerRef.current &&
        !containerRef.current.contains(target)
      ) {
        closeAndReset();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const closeAndReset = () => {
    setIsOpen(false);
    setPhase("search");
    setQuery(value);
    setSuggestions([]);
    setActiveIndex(-1);
  };

  const commitExisting = (ingredient: Ingredient) => {
    onSelect(ingredient.id, ingredient.name);
    setQuery(ingredient.name);
    setIsOpen(false);
    setPhase("search");
    setSuggestions([]);
    setActiveIndex(-1);
  };

  const commitNew = async (category: IngredientCategory) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      const created = await createIngredient(trimmed, category);
      onSelect(created.id, created.name);
      setQuery(created.name);
      setIsOpen(false);
      setPhase("search");
      setSuggestions([]);
      setActiveIndex(-1);
    } catch {
      // leave open so the user can try again
    } finally {
      setCreating(false);
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
