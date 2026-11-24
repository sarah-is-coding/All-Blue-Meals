import { useEffect, useRef } from "react";

/**
 * After the user adds a row (an ingredient or a substitute), scroll it into
 * view and put the cursor in its name field, so a long list never means
 * scrolling down to find the new, empty row.
 *
 * Call `expectAddedRow()` just before adding; the next row id that appears
 * in `rowIds` is focused. Rows are found by `data-row-id` inside `listRef`.
 * Rows that appear any other way (loading, an import) are left alone.
 */
export function useFocusAddedRow(rowIds: ReadonlyArray<string>) {
  const listRef = useRef<HTMLDivElement>(null);
  const knownIds = useRef<ReadonlySet<string>>(new Set(rowIds));
  const expecting = useRef(false);
  const idsKey = rowIds.join("|");

  useEffect(() => {
    const ids = idsKey ? idsKey.split("|") : [];
    const added = ids.find((id) => !knownIds.current.has(id));
    knownIds.current = new Set(ids);
    if (!added || !expecting.current) return;
    expecting.current = false;

    const row = Array.from(listRef.current?.querySelectorAll<HTMLElement>("[data-row-id]") ?? []).find(
      (element) => element.dataset.rowId === added
    );
    const field = row?.querySelector<HTMLInputElement>('[role="combobox"], input');
    if (!field) return;
    field.focus({ preventScroll: true });
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    field.scrollIntoView?.({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
  }, [idsKey]);

  return {
    listRef,
    expectAddedRow: () => {
      expecting.current = true;
    },
  };
}
