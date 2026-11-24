import { useCallback, useState } from "react";

/**
 * Items ticked off while cooking (gathered ingredients, finished steps): kept
 * only for this visit, never saved. Everything is unticked again whenever
 * `resetKey` changes, e.g. when the recipe's steps or ingredients are edited.
 */
export function useTickedItems<Item extends string | number>(resetKey: string) {
  const [ticked, setTicked] = useState<ReadonlySet<Item>>(() => new Set());
  const [tickedFor, setTickedFor] = useState(resetKey);
  if (tickedFor !== resetKey) {
    setTickedFor(resetKey);
    setTicked(new Set());
  }

  const toggle = useCallback(
    (item: Item) =>
      setTicked((current) => {
        const next = new Set(current);
        if (next.has(item)) next.delete(item);
        else next.add(item);
        return next;
      }),
    []
  );
  const reset = useCallback(() => setTicked(new Set()), []);

  return { isTicked: (item: Item) => ticked.has(item), count: ticked.size, toggle, reset };
}
