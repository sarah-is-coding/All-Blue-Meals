// Small text clean-ups shared by recipe saving and ingredient parsing.

// Words an AI import sometimes writes instead of leaving a field empty.
const MISSING_VALUE_WORDS = new Set(["null", "none", "n/a", "na", "undefined", "nil", "-"]);

/**
 * Trim and collapse whitespace; return "" for empty input or for a word that
 * means "no value" ("null", "none", "n/a", …), in any case.
 */
export const cleanMissingText = (value: string | null | undefined): string => {
  const collapsed = (value ?? "").replace(/\s+/g, " ").trim();
  return MISSING_VALUE_WORDS.has(collapsed.toLowerCase()) ? "" : collapsed;
};

/**
 * Join note fragments with ", ", dropping empties and case-insensitive
 * repeats while keeping first-seen order.
 */
export const joinNotes = (parts: ReadonlyArray<string | null | undefined>): string => {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const part of parts) {
    const cleaned = cleanMissingText(part);
    const key = cleaned.toLowerCase();
    if (cleaned && !seen.has(key)) {
      seen.add(key);
      kept.push(cleaned);
    }
  }
  return kept.join(", ");
};
