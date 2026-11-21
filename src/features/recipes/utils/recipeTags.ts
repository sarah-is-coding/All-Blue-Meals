// Which of a recipe's tags fit in a short preview (e.g. a home page meal card).

// "marinate", "Marinated overnight", "marinating": a reminder to start early,
// so these come first.
const MARINATE = /marinat/i;

export type TagPreview = {
  /** The tags to show, marinate tags first, otherwise in the recipe's order. */
  shown: string[];
  /** How many tags didn't fit ("+2 more"). */
  hiddenCount: number;
};

/** Up to `max` tags (blank ones dropped), with any marinate tag first. */
export function previewTags(tags: ReadonlyArray<string>, max: number): TagPreview {
  const cleaned = tags.map((tag) => tag.trim()).filter(Boolean);
  const ordered = [
    ...cleaned.filter((tag) => MARINATE.test(tag)),
    ...cleaned.filter((tag) => !MARINATE.test(tag)),
  ];
  const limit = Math.max(0, max);
  return { shown: ordered.slice(0, limit), hiddenCount: Math.max(0, ordered.length - limit) };
}
