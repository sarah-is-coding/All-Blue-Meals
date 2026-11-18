// The matching key for ingredient names, and which name to show.
// Two names with the same key are the same ingredient: case, accents,
// punctuation, spaces and simple plurals don't matter. Synonyms
// ("scallions" → green onion) are resolved separately through the
// ingredient_aliases table, which stores alias keys made by this function.
// See docs/ingredient-normalization.md ("Match on the key", "Alias table").

import { KEEP_PLURAL_LAST_WORDS } from "../constants";

// Words that only look plural, or whose plural is irregular.
const NOT_PLURAL = new Set([
  "hummus", "asparagus", "couscous", "molasses", "swiss", "citrus", "lemongrass",
  "watercress", "series", "species", "brussels",
]);
const IRREGULAR_SINGULARS: Record<string, string> = {
  leaves: "leaf",
  loaves: "loaf",
  halves: "half",
  knives: "knife",
  chilies: "chili",
  chilis: "chili",
  chiles: "chile",
  cookies: "cookie",
  brownies: "brownie",
  veggies: "veggie",
  pies: "pie",
  smoothies: "smoothie",
  calories: "calorie",
};

/** Lowercase, strip accents and symbols, "&" → "and", punctuation → spaces. */
export const foldText = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[®™©]/g, "")
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Singular form of one lowercase word, by simple English rules. */
export const singularizeWord = (word: string): string => {
  const irregular = IRREGULAR_SINGULARS[word];
  if (irregular) return irregular;
  if (word.length <= 3 || NOT_PLURAL.has(word)) return word;
  if (/(ss|us|is)$/.test(word)) return word;
  if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.endsWith("oes")) return word.slice(0, -2);
  if (/(ch|sh|x|z|ss)es$/.test(word)) return word.slice(0, -2);
  if (word.endsWith("s")) return word.slice(0, -1);
  return word;
};

/**
 * The matching key: "Jalapeños" and "jalapeno" → "jalapeno";
 * "sun-dried tomatoes" and "sundried tomato" → "sundriedtomato".
 * Returns "" for an empty name.
 */
export const ingredientKey = (name: string): string => ingredientWords(name).join("");

/** The words of a name as the key sees them: folded and singular. */
export const ingredientWords = (name: string): string[] =>
  foldText(name).split(" ").filter(Boolean).map(singularizeWord);

/**
 * Whether `canonical` can safely be an alias target for `written`: the same
 * words in another order ("skinless boneless" / "boneless skinless"), or no
 * words in common ("scallions" / "green onion"). Names that share some words
 * but not others are variants or broader/narrower items ("red onion" /
 * "yellow onion", "chicken breasts" / "boneless skinless chicken breasts"),
 * never synonyms. Same key, or an empty name, is not an alias at all.
 * Mirrored by the add_ingredient_alias database function.
 */
export const isSafeSynonym = (written: string, canonical: string): boolean => {
  const writtenWords = new Set(ingredientWords(written));
  const canonicalWords = new Set(ingredientWords(canonical));
  if (writtenWords.size === 0 || canonicalWords.size === 0) return false;
  if (ingredientKey(written) === ingredientKey(canonical)) return false;
  const shared = [...writtenWords].filter((word) => canonicalWords.has(word)).length;
  const sameWords = shared === writtenWords.size && shared === canonicalWords.size;
  return sameWords || shared === 0;
};

const keepsPlural = (words: string[]): boolean => {
  const last = words[words.length - 1] ?? "";
  if (KEEP_PLURAL_LAST_WORDS.includes(last) || last.endsWith("berries")) return true;
  // "cherry tomatoes", "diced tomatoes" stay plural; plain "tomatoes" doesn't.
  return last === "tomatoes" && words.length > 1;
};

/**
 * Display form of a name: singular by default ("onions" → "onion"), plural
 * kept for things normally written that way ("eggs", "black beans",
 * "cherry tomatoes"). Keeps the original spelling otherwise.
 */
export const singularDisplayName = (name: string): string => {
  const words = name.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0 || keepsPlural(words)) return words.join(" ");
  const last = words[words.length - 1] ?? "";
  if (!/^[a-z]+$/.test(last)) {
    // Accented word: only drop a plain trailing "s" so accents survive
    // ("jalapeños" → "jalapeño"); anything else stays as written.
    const folded = foldText(last);
    const singular = singularizeWord(folded);
    const shortened = singular === folded.slice(0, -1) && last.endsWith("s");
    return [...words.slice(0, -1), shortened ? last.slice(0, -1) : last].join(" ");
  }
  return [...words.slice(0, -1), singularizeWord(last)].join(" ");
};

export type NameVariant = { name: string; uses: number };

/**
 * Pick the name to keep when variants merge: the most used one (fewer
 * commas, then alphabetical, break ties), shown in its singular display form.
 */
export const chooseDisplayName = (variants: ReadonlyArray<NameVariant>): string => {
  const commas = (name: string) => (name.match(/,/g) ?? []).length;
  const [best] = [...variants].sort(
    (a, b) => b.uses - a.uses || commas(a.name) - commas(b.name) || a.name.localeCompare(b.name)
  );
  return best ? singularDisplayName(best.name) : "";
};
