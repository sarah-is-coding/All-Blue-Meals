import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { buildGroceryItemsForRange, buildGroceryItemsForSavedPlan } from "../api";
import { useGroceryListActions } from "../queries";
import { usePlannedMealsBetween } from "../../meal-plans/queries";
import DateRangePicker from "../../meal-plans/components/DateRangePicker";
import GroceryPlanBrowser from "../components/GroceryPlanBrowser";
import type { GroceryItemDraft, GroceryList, GroceryListOrigin, GrocerySource } from "../types";
import { groupItemsByCategory } from "../utils/groceryGeneration";
import {
  addDays,
  createDateFromIso,
  formatDateRange,
  getWeekEndIso,
  getWeekStartIso,
  toIsoDate,
} from "../../../lib/utils/dates";
import type { SavedMealPlan } from "../../meal-plans/types";

export default function GroceryPage() {
  const groceryActions = useGroceryListActions();
  const currentWeekStartIso = useMemo(() => getWeekStartIso(new Date()), []);
  const weekRange = (weekStartIso: string): GrocerySource => ({
    kind: "range",
    startIso: weekStartIso,
    endIso: getWeekEndIso(weekStartIso),
  });

  // ── Source (dates or a saved plan to generate from) ──────────────────────
  const [source, setSource] = useState<GrocerySource>(() => weekRange(currentWeekStartIso));

  // ── Generation state ──────────────────────────────────────────────────────
  const [draftItems, setDraftItems] = useState<GroceryItemDraft[] | null>(null);
  // What the draft was built from, saved with the list.
  const [draftOrigin, setDraftOrigin] = useState<GroceryListOrigin | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Local checkbox state for unsaved draft list (index-keyed)
  const [localChecked, setLocalChecked] = useState(new Set<number>());

  // ── Saved list state ───────────────────────────────────────────────────────
  const [savedList, setSavedList] = useState<GroceryList | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  // ── Save form ─────────────────────────────────────────────────────────────
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveInputRef = useRef<HTMLInputElement>(null);

  // ── Derived values ────────────────────────────────────────────────────────
  // How many meals are planned in the chosen dates (the ones the list will use).
  // The picker never produces a backwards range, so the dates are always valid.
  const rangeMeals = usePlannedMealsBetween(
    source.kind === "range" ? source.startIso : "",
    source.kind === "range" ? source.endIso : "",
    source.kind === "range"
  );
  const plannedMealCount = rangeMeals.items.length;

  const sourceLabel = useMemo(() => {
    if (source.kind === "range") {
      return formatDateRange(source.startIso, source.endIso);
    }
    return source.planLabel;
  }, [source]);

  const sourceDateRange = useMemo(() => {
    if (source.kind === "range") return null;
    return formatDateRange(source.startDate, source.endDate);
  }, [source]);

  const defaultSaveTitle = `Grocery – ${sourceLabel}`;

  // ── Handlers ──────────────────────────────────────────────────────────────

  function clearList() {
    setDraftItems(null);
    setDraftOrigin(null);
    setSavedList(null);
    setLocalChecked(new Set());
    setShowSaveForm(false);
    setGenerateError(null);
  }

  const selectRange = (next: GrocerySource) => {
    setSource(next);
    clearList();
  };

  /** Move the whole range by `days`, keeping its length. */
  const handleShiftRange = (days: number) => {
    if (source.kind !== "range") return;
    const shift = (iso: string) => toIsoDate(addDays(createDateFromIso(iso), days));
    selectRange({ kind: "range", startIso: shift(source.startIso), endIso: shift(source.endIso) });
  };

  const handleSelectSavedPlan = (plan: SavedMealPlan) => {
    setSource({
      kind: "saved_plan",
      planId: plan.id,
      planLabel: plan.savedName,
      startDate: plan.startDate,
      endDate: plan.endDate,
    });
    clearList();
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGenerateError(null);
    setDraftItems(null);
    setSavedList(null);
    setLocalChecked(new Set());
    setShowSaveForm(false);

    try {
      if (source.kind === "range") {
        const items = await buildGroceryItemsForRange(source.startIso, source.endIso);
        setDraftItems(items);
        setDraftOrigin({ kind: "range", startDate: source.startIso, endDate: source.endIso });
      } else {
        const items = await buildGroceryItemsForSavedPlan(source.planId);
        setDraftItems(items);
        setDraftOrigin({ kind: "saved_plan", savedPlanId: source.planId });
      }
    } catch (e) {
      setGenerateError(
        e instanceof Error ? e.message : "Failed to generate grocery list."
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleOpenSaveForm = () => {
    setSaveTitle(defaultSaveTitle);
    setShowSaveForm(true);
    // Focus the input after render
    window.setTimeout(() => saveInputRef.current?.focus(), 0);
  };

  const handleSave = async () => {
    if (!draftItems || !draftOrigin || !saveTitle.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const list = await groceryActions.save(
        saveTitle.trim(),
        draftOrigin,
        draftItems
      );
      setSavedList(list);
      setDraftItems(null);
      setShowSaveForm(false);
    } catch (e) {
      setSaveError(
        e instanceof Error ? e.message : "Failed to save grocery list."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSavedItem = async (
    itemId: string,
    isChecked: boolean
  ) => {
    setTogglingId(itemId);
    setToggleError(null);
    try {
      if (savedList) await groceryActions.toggleItem(savedList.id, itemId, isChecked);
      setSavedList((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((item) =>
            item.id === itemId ? { ...item, isChecked } : item
          ),
        };
      });
    } catch (e) {
      setToggleError(
        e instanceof Error ? e.message : "Failed to update item."
      );
    } finally {
      setTogglingId((id) => (id === itemId ? null : id));
    }
  };

  const handleLocalToggle = (idx: number) => {
    setLocalChecked((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  // ── Display items: DB-backed when saved, local-state when draft ────────────
  const hasList = savedList !== null || draftItems !== null;

  const displayItems = savedList
    ? savedList.items
    : (draftItems ?? []).map((item, idx) => ({
        id: String(idx),
        ...item,
        isChecked: localChecked.has(idx),
      }));

  const checkedCount = displayItems.filter((i) => i.isChecked).length;
  const totalCount = displayItems.length;

  return (
    <section className="workspace-route grocery-route">
      {/* Header */}
      <article className="workspace-card grocery-route__header">
        <div className="grocery-route__title-row">
          <h1>Grocery Lists</h1>
          <Link
            to="/app/saved-grocery-lists"
            className="grocery-route__manage-link"
          >
            Manage saved lists →
          </Link>
        </div>
      </article>

      <div className="grocery-layout">
        {/* ── Left/top: source selector ── */}
        <div className="grocery-source">
          <article className="workspace-card grocery-source__card">
            <h2 className="grocery-source__heading">Dates</h2>

            {source.kind === "range" ? (
              <div className="grocery-source__range">
                <DateRangePicker
                  startIso={source.startIso}
                  endIso={source.endIso}
                  onChange={(startIso, endIso) => selectRange({ kind: "range", startIso, endIso })}
                />
                <div className="grocery-source__week-nav">
                  <button
                    type="button"
                    className="btn btn--ghost grocery-source__nav-btn"
                    onClick={() => handleShiftRange(-7)}
                    aria-label="Move dates back a week"
                  >
                    ←
                  </button>
                  <p className="grocery-source__week-label">{sourceLabel}</p>
                  <button
                    type="button"
                    className="btn btn--ghost grocery-source__nav-btn"
                    onClick={() => handleShiftRange(7)}
                    aria-label="Move dates forward a week"
                  >
                    →
                  </button>
                </div>
                {!rangeMeals.error && (
                  <p className="grocery-source__meal-count" aria-live="polite">
                    {rangeMeals.loading
                      ? "Counting planned meals…"
                      : plannedMealCount === 0
                        ? "No meals planned for these dates"
                        : `${plannedMealCount} planned meal${plannedMealCount === 1 ? "" : "s"} in these dates`}
                  </p>
                )}
              </div>
            ) : (
              <div className="grocery-source__plan-info">
                <p className="grocery-source__plan-name">{sourceLabel}</p>
                {sourceDateRange && (
                  <p className="grocery-source__plan-range">
                    {sourceDateRange}
                  </p>
                )}
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => selectRange(weekRange(currentWeekStartIso))}
                >
                  ← Back to dates
                </button>
              </div>
            )}

            <GroceryPlanBrowser onSelectSavedPlan={handleSelectSavedPlan} />

            <button
              type="button"
              className="btn btn--primary"
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? "Building…" : "Build Grocery List"}
            </button>

            {generateError && (
              <p className="error grocery-route__error">{generateError}</p>
            )}
          </article>
        </div>

        {/* ── Right/main: grocery list ── */}
        <div className="grocery-list-area">
          {!hasList && !generating && (
            <article className="workspace-card grocery-empty-state">
              <p>
                Select a week or saved plan, then click{" "}
                <strong>Build Grocery List</strong> to generate your shopping
                list.
              </p>
            </article>
          )}

          {hasList && (
            <article className="workspace-card grocery-list">
              <div className="grocery-list__header">
                <div className="grocery-list__title-group">
                  <h2 className="grocery-list__title">
                    {savedList
                      ? savedList.title
                      : `Grocery List · ${sourceLabel}`}
                  </h2>
                  {totalCount > 0 && (
                    <span className="grocery-list__count">
                      {checkedCount}/{totalCount} checked
                    </span>
                  )}
                </div>

                <div className="grocery-list__actions">
                  {!savedList &&
                    draftItems !== null &&
                    draftItems.length > 0 &&
                    !showSaveForm && (
                      <button
                        type="button"
                        className="btn btn--ghost"
                        onClick={handleOpenSaveForm}
                      >
                        Save list…
                      </button>
                    )}
                  {savedList && (
                    <Link
                      to="/app/saved-grocery-lists"
                      className="btn btn--ghost"
                    >
                      Manage saved lists
                    </Link>
                  )}
                </div>
              </div>

              {showSaveForm && (
                <div className="grocery-save-form">
                  <input
                    ref={saveInputRef}
                    type="text"
                    className="grocery-save-form__input"
                    placeholder="List name"
                    value={saveTitle}
                    maxLength={80}
                    onChange={(e) => setSaveTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleSave();
                      if (e.key === "Escape") setShowSaveForm(false);
                    }}
                  />
                  <div className="grocery-save-form__actions">
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => setShowSaveForm(false)}
                      disabled={saving}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => void handleSave()}
                      disabled={saving || !saveTitle.trim()}
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>
                  </div>
                  {saveError && <p className="error">{saveError}</p>}
                </div>
              )}

              {savedList && (
                <p className="grocery-list__saved-badge">
                  ✓ Saved — you can find this list under{" "}
                  <Link
                    to="/app/saved-grocery-lists"
                    className="grocery-list__saved-link"
                  >
                    Manage saved lists
                  </Link>
                  .
                </p>
              )}

              {toggleError && <p className="error">{toggleError}</p>}

              {displayItems.length === 0 ? (
                <p className="grocery-list__empty">
                  No ingredients found for this plan. Make sure your recipes
                  have ingredients added.
                </p>
              ) : (
                <div className="grocery-item-groups">
                  {groupItemsByCategory(displayItems).map((group) => {
                    const isDB = savedList !== null;
                    return (
                      <div key={group.label} className="grocery-category">
                        <h3 className="grocery-category__header">
                          {group.label}
                        </h3>
                        <ul
                          className="grocery-item-list"
                          aria-label={`${group.label} items`}
                        >
                          {group.items.map((item) => (
                            <li
                              key={item.id}
                              className={`grocery-item${
                                item.isChecked ? " grocery-item--checked" : ""
                              }`}
                            >
                              <label className="grocery-item__label">
                                <input
                                  type="checkbox"
                                  className="grocery-item__checkbox"
                                  checked={item.isChecked}
                                  disabled={isDB ? togglingId === item.id : false}
                                  onChange={(e) => {
                                    if (isDB) {
                                      void handleToggleSavedItem(
                                        item.id,
                                        e.target.checked
                                      );
                                    } else {
                                      handleLocalToggle(
                                        displayItems.indexOf(item)
                                      );
                                    }
                                  }}
                                />
                                <span className="grocery-item__name">
                                  {item.ingredientName}
                                </span>
                                {(item.quantity || item.unit) && (
                                  <span className="grocery-item__amount">
                                    {[item.quantity, item.unit]
                                      .filter(Boolean)
                                      .join(" ")}
                                  </span>
                                )}
                              </label>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
            </article>
          )}
        </div>
      </div>
    </section>
  );
}
