// Split free-text ingredient names into a clean name, notes, substitutes,
// or several ingredients, following the cautious merge rule in
// docs/ingredient-normalization.md. Pure: no database access. Callers that
// know the catalog pass `isKnownIngredient` to resolve "or" options better.

import {
  CUT_NOUNS,
  FORM_WORDS,
  FORM_WORD_KEEPERS,
  LEADING_WORD_KEEPERS,
  NAME_DESCRIPTORS,
  NOTE_PHRASES,
  NOTE_START_WORDS,
  PLACEHOLDER_NAMES,
  PREP_WORDS,
  PRODUCT_FORM_WORDS,
  SHARED_HEAD_NOUNS,
  SIZE_WORDS,
  STAPLE_PAIRS,
  STATE_WORDS,
  VAGUE_OPTION_WORDS,
  WHOLE_ONLY_BASES,
} from "../constants";
import { ingredientKey, singularizeWord } from "./ingredientKey";

export type ParsedName = {
  name: string;
  notes: string[];
  /** Unit implied by the name ("garlic cloves" → "clove"), used when the line has none. */
  unitHint: string | null;
};

export type ParsedItem = ParsedName & { substitutes: ParsedName[] };

export type ReviewFlag = "brand" | "unclear-comma" | "placeholder" | "list";

export type ParsedIngredientText = {
  items: ParsedItem[];
  /** How a line became several items: a list ("broccoli, zucchini, …") or staples ("salt and pepper"). */
  split: "list" | "staples" | null;
  flags: ReviewFlag[];
};

export type ParseOptions = {
  isKnownIngredient?: (name: string) => boolean;
};

const keySet = (names: ReadonlyArray<string>) => new Set(names.map(ingredientKey));
const WHOLE_ONLY_KEYS = keySet(WHOLE_ONLY_BASES);
const STAPLE_KEYS = keySet(STAPLE_PAIRS);
const PLACEHOLDER_KEYS = keySet(PLACEHOLDER_NAMES);
const FORM_KEEPER_KEYS = keySet(FORM_WORD_KEEPERS);
const LEADING_NOTE_WORDS = [...SIZE_WORDS, ...STATE_WORDS].sort((a, b) => b.length - a.length);
const PREP = new Set(PREP_WORDS);
const NOTE_STARTERS = new Set([...PREP_WORDS, ...NOTE_START_WORDS, ...SIZE_WORDS, ...STATE_WORDS]);

const words = (text: string) => text.split(" ").filter(Boolean);
const lastOf = <T,>(list: ReadonlyArray<T>): T | undefined => list[list.length - 1];

const startsWithPhrase = (text: string, phrase: string) =>
  text === phrase || text.startsWith(`${phrase} `);

/** Strip size, state and prep words from one name; see the cautious rule. */
export const parseName = (input: string): ParsedName => {
  let text = input.trim();
  const notes: string[] = [];
  let unitHint: string | null = null;

  // Leading note phrases and size/state words: "freshly ground", "large".
  for (let changed = true; changed; ) {
    changed = false;
    for (const phrase of [...NOTE_PHRASES, ...LEADING_NOTE_WORDS]) {
      const rest = text.slice(phrase.length + 1);
      const next = words(rest)[0] ?? "";
      if (startsWithPhrase(text, phrase) && rest && !LEADING_WORD_KEEPERS.includes(next)) {
        notes.push(phrase);
        text = rest.trim();
        changed = true;
        break;
      }
    }
  }

  let list = words(text);

  // Trailing prep words: "parm cheese shredded".
  while (list.length > 1 && PREP.has(lastOf(list) ?? "")) {
    notes.unshift(list.pop() ?? "");
  }

  // Form words: "basil leaves", "garlic cloves" (→ unit clove).
  const last = lastOf(list) ?? "";
  if (list.length > 1 && last in FORM_WORDS) {
    const base = list.slice(0, -1).join(" ");
    if (!FORM_KEEPER_KEYS.has(ingredientKey(base))) {
      const unit = FORM_WORDS[last];
      if (unit) unitHint = unit;
      else notes.push(last);
      list = list.slice(0, -1);
    }
  }

  // Leading prep before something only bought whole: "minced garlic", "whole garlic".
  while (list.length > 1 && (PREP.has(list[0] ?? "") || list[0] === "whole")) {
    if (!WHOLE_ONLY_KEYS.has(ingredientKey(list.slice(1).join(" ")))) break;
    notes.push(list.shift() ?? "");
  }

  return { name: list.join(" "), notes, unitHint };
};

// "juice of 2 limes" → "lime juice"; "zest of lemon" → "lemon zest".
const reorderOf = (text: string) =>
  text.replace(
    /^(juice|zest) of (?:(?:a|an|one|half|\d+(?:\/\d+)?) )?(?:the )?(.+)$/,
    (_m, part: string, rest: string) => {
      const restWords = words(rest);
      const tail = singularizeWord(restWords.pop() ?? "");
      return [...restWords, tail, part].join(" ");
    }
  );

const isNoteLike = (part: string) => {
  const first = words(part)[0] ?? "";
  return /^\d/.test(first) || NOTE_STARTERS.has(first) || NOTE_PHRASES.some((p) => startsWithPhrase(part, p));
};

const isVagueOption = (option: string) =>
  VAGUE_OPTION_WORDS.some((word) => startsWithPhrase(option, word)) || option.includes("of choice");

/** Give one-word "or" options the shared head noun: "olive or grapeseed oil". */
const expandOptions = (options: string[], isKnown: (name: string) => boolean): string[] => {
  const lastWords = words(lastOf(options) ?? "");
  const firstWords = words(options[0] ?? "");
  return options.map((option, index) => {
    const optionWords = words(option);
    if (index < options.length - 1 && optionWords.length === 1 && lastWords.length > 1) {
      const candidate = [option, ...lastWords.slice(1)].join(" ");
      const head = lastOf(lastWords) ?? "";
      if (isKnown(candidate) || (!isKnown(option) && SHARED_HEAD_NOUNS.includes(head))) {
        return candidate;
      }
    }
    if (index > 0 && optionWords.length === 1 && firstWords.length > 1 && !isKnown(option)) {
      if (CUT_NOUNS.includes(option)) return [...firstWords.slice(0, -1), option].join(" ");
      if (PRODUCT_FORM_WORDS.includes(firstWords[0] ?? "")) return `${firstWords[0]} ${option}`;
    }
    return option;
  });
};

const toItem = (name: ParsedName, substitutes: ParsedName[] = []): ParsedItem => ({
  ...name,
  substitutes,
});

/**
 * Parse an ingredient name as written in a recipe. Returns one item, or
 * several when the text lists ingredients ("broccoli, zucchini, mushrooms")
 * or combines staples ("salt and pepper"). Anything unclear is flagged.
 */
export const parseIngredientText = (
  input: string,
  options: ParseOptions = {}
): ParsedIngredientText => {
  const isKnown = options.isKnownIngredient ?? (() => false);
  const flags = new Set<ReviewFlag>();
  const raw = input.replace(/\s+/g, " ").trim();
  if (!raw) return { items: [], split: null, flags: [] };
  if (/[®™©]/.test(raw) || /^[a-z]+['’]s\s/i.test(raw)) flags.add("brand");

  let text = raw.toLowerCase().replace(/[®™©]/g, "").replace(/[’`]/g, "'");
  const commaNotes: string[] = [];

  // Parentheses: "(or thighs)" becomes an option; anything else is a note.
  text = text.replace(/\(([^)]*)\)/g, (_m, inner: string) => {
    const cleaned = inner.trim();
    if (/^or /.test(cleaned)) return ` ${cleaned} `;
    if (cleaned) commaNotes.push(cleaned);
    return " ";
  });
  // Leading descriptors separated by commas: "boneless, skinless chicken".
  text = text
    .replace(/^(?:(?:boneless|skinless|bone-in|skin-on|bone in|skin on)\s*,\s*)+/, (prefix) =>
      prefix.replace(/\s*,\s*/g, " ")
    )
    .replace(/\s+/g, " ")
    .trim();
  text = reorderOf(text);

  const [head = "", ...rest] = text.split(",").map((part) => part.trim()).filter(Boolean);
  const descriptors: string[] = [];
  const unclear: string[] = [];
  for (const part of rest) {
    const descriptor = NAME_DESCRIPTORS[part];
    if (descriptor) descriptors.push(descriptor);
    else if (isNoteLike(part)) commaNotes.push(part);
    else unclear.push(part);
  }

  if (unclear.length > 0) {
    const parts = [head, ...rest].map((part) => part.replace(/^and /, ""));
    const looksLikeList =
      parts.length >= 3 && parts.every((part) => words(part).length <= 3 && !isNoteLike(part));
    if (looksLikeList) {
      flags.add("list");
      return { items: parts.map((part) => toItem(parseName(part))), split: "list", flags: [...flags] };
    }
    flags.add("unclear-comma");
    const name = parseName(text.replace(/\s*,\s*/g, ", "));
    return { items: [toItem(name)], split: null, flags: [...flags] };
  }

  const nameText = [...descriptors, head].join(" ");

  // "salt and pepper" → two staples sharing the line's amount.
  const andParts = nameText.split(/\s+(?:and|&)\s+/);
  if (andParts.length > 1) {
    const parsed = andParts.map(parseName);
    if (parsed.every((part) => STAPLE_KEYS.has(ingredientKey(part.name)))) {
      const items = parsed.map((part) =>
        toItem({
          ...part,
          name: part.name === "pepper" ? "black pepper" : part.name,
          notes: [...part.notes, ...commaNotes],
        })
      );
      return { items, split: "staples", flags: [...flags] };
    }
  }

  // "olive or avocado oil", "coriander / cilantro": main + substitutes.
  const rawOptions = nameText.split(/\s+(?:and\/or|or)\s+|\s+\/\s+/).map((o) => o.trim());
  const specific = rawOptions.filter((option, index) => index === 0 || !isVagueOption(option));
  const vagueNotes = rawOptions.filter((option, index) => index > 0 && isVagueOption(option));
  const [main, ...subs] = expandOptions(specific, isKnown).map(parseName);
  const mainName = main ?? { name: "", notes: [], unitHint: null };
  const item = toItem(
    {
      ...mainName,
      notes: [...mainName.notes, ...vagueNotes.map((o) => `or ${o}`), ...commaNotes],
    },
    subs
  );
  if ([item, ...subs].some((part) => PLACEHOLDER_KEYS.has(ingredientKey(part.name)))) {
    flags.add("placeholder");
  }
  return { items: [item], split: null, flags: [...flags] };
};
