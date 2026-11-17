// Word lists behind the ingredient naming rules (see utils/ingredientKey.ts
// and utils/ingredientText.ts, and docs/ingredient-normalization.md).
// These are grammar rules, not synonyms: synonyms ("scallions" → green
// onion) are data in the ingredient_aliases table, so imports can add them.

/** Size words: always notes ("large onion" → onion, note "large"). */
export const SIZE_WORDS = [
  "small", "medium", "large", "extra-large", "extra large", "medium-large", "jumbo", "big",
];

/** Freshness, temperature, quality and state words: always notes. */
// Not "hot" or "cold": hot sauce, hot dog buns, cold brew are products.
export const STATE_WORDS = [
  "fresh", "freshly", "organic", "ripe", "warm", "cooled", "boiling",
  "softened", "melted", "chilled", "room temperature", "wild-caught", "wild caught",
  "good quality", "high quality", "store-bought", "homemade", "leftover", "optional",
];

/**
 * Next words that make a leading size/state word part of the product:
 * "fresh mozzarella", "fresh pasta", "medium cheddar".
 */
export const LEADING_WORD_KEEPERS = ["mozzarella", "pasta", "noodles", "yeast", "cheddar", "salsa"];

/** Phrases that read as one note: "freshly ground black pepper". */
export const NOTE_PHRASES = [
  "freshly ground", "freshly cracked", "freshly grated", "freshly squeezed",
  "freshly shaved", "finely chopped", "roughly chopped", "coarsely chopped",
  "thinly sliced", "finely grated", "finely minced", "at room temperature",
];

/**
 * Prep the cook does. Moves to notes when it comes after the name or after
 * a comma ("onion, diced"). Before the name it usually names a product
 * ("diced tomatoes"), so it stays, except for WHOLE_ONLY_BASES.
 */
export const PREP_WORDS = [
  "chopped", "minced", "diced", "sliced", "grated", "shredded", "crushed", "halved",
  "quartered", "peeled", "trimmed", "cubed", "julienned", "mashed", "pitted", "seeded",
  "cored", "zested", "juiced", "torn", "rinsed", "drained", "divided", "beaten",
  "whisked", "sifted", "packed", "thawed", "cut", "roasted", "cooked", "stemmed",
  "deveined", "washed", "warmed", "prepared", "shaved", "patted", "squeezed",
];

/** Adverbs and connectors that start a note after a comma ("finely chopped", "for serving"). */
export const NOTE_START_WORDS = [
  "finely", "thinly", "roughly", "coarsely", "lightly", "well", "plus", "for", "to",
  "about", "such", "at", "into", "if", "as", "preferably", "optional", "from", "with",
  "without", "loosely", "tightly", "very", "cold", "at", "in", "approximately",
];

/**
 * Things you'd only ever buy whole, so a leading prep word is something the
 * cook does: "minced garlic" → garlic, note "minced".
 */
// Cautious: tomatoes (canned diced/crushed), carrots and potatoes (sold
// shredded/mashed) are left out on purpose.
export const WHOLE_ONLY_BASES = [
  "garlic", "onion", "red onion", "yellow onion", "white onion", "sweet onion",
  "shallot", "green onion", "parsley", "cilantro", "basil", "mint", "dill", "chive",
  "ginger", "celery", "lemon", "lime", "orange", "jalapeno", "bell pepper",
  "red bell pepper", "green bell pepper", "cucumber", "zucchini", "avocado",
  "rosemary", "thyme", "sage",
];

/**
 * How it comes, not what it is: "basil leaves", "broccoli florets". Maps the
 * word to the unit it becomes when the line has no unit, or null to keep it
 * as a note.
 */
export const FORM_WORDS: Record<string, string | null> = {
  leaves: null,
  leaf: null,
  sprigs: "sprig",
  sprig: "sprig",
  florets: null,
  kernels: null,
  cloves: "clove",
  clove: "clove",
  slices: "slice",
  fillets: null,
  fillet: null,
};

/**
 * Bases where a form word is part of the name: "bay leaves", "ground cloves"
 * (the spice), "whole cloves". "garlic cloves" is not one.
 */
export const FORM_WORD_KEEPERS = [
  "bay", "dried bay", "curry", "kaffir lime", "lime", "banana", "fig", "grape", "ground", "whole",
];

/** Descriptors that belong in front of the name even when written after a comma. */
export const NAME_DESCRIPTORS: Record<string, string> = {
  "bone in": "bone-in",
  "bone-in": "bone-in",
  "skin on": "skin-on",
  "skin-on": "skin-on",
  boneless: "boneless",
  skinless: "skinless",
};

/** Words that start a vague "or" option, which goes to notes, not substitutes. */
export const VAGUE_OPTION_WORDS = ["other", "any", "your favorite", "favorite", "similar"];

/**
 * Last words that make an "or" option's head noun shareable:
 * "chicken or beef broth" → chicken broth, beef broth.
 */
export const SHARED_HEAD_NOUNS = [
  "oil", "broth", "stock", "vinegar", "pasta", "rice", "chilies", "chiles", "chili",
  "peppers", "pepper", "tomatoes", "cheese", "sugar", "flour", "milk", "wine", "beans",
  "seeds", "nuts", "sauce", "greens", "steak", "noodles", "tortillas", "lettuce",
];

/** Cuts that take the rest of the name: "chicken breasts or thighs". */
export const CUT_NOUNS = [
  "thighs", "thigh", "breasts", "breast", "legs", "leg", "wings", "wing",
  "drumsticks", "drumstick", "chops", "chop", "tenderloin", "loin",
];

/** Product forms that carry over to a one-word option: "ground beef or lamb". */
export const PRODUCT_FORM_WORDS = ["ground", "dried", "frozen", "canned", "smoked"];

/** Ingredients that may be combined with "and": "salt and pepper". */
export const STAPLE_PAIRS = [
  "salt", "kosher salt", "sea salt", "flaky sea salt", "black pepper", "pepper", "white pepper",
];

/** Names that are not something you can buy. Flagged for review. */
export const PLACEHOLDER_NAMES = [
  "toppings", "topping", "condiments", "seasoning", "seasonings", "vegetables", "veggies",
  "fresh herbs", "herbs", "icing ingredients", "garnish", "garnishes", "spices", "filling",
];

/** Last words that read better plural: "black beans", "eggs", "cherry tomatoes". */
export const KEEP_PLURAL_LAST_WORDS = [
  "beans", "chips", "flakes", "seeds", "noodles", "oats", "peas", "lentils", "chickpeas",
  "crumbs", "breadcrumbs", "greens", "sprouts", "capers", "raisins", "nuts", "almonds",
  "walnuts", "pecans", "cashews", "peanuts", "pistachios", "olives", "eggs", "sprinkles",
  "marshmallows", "crackers", "croutons", "pickles", "grits", "mushrooms", "fingers",
  "shells", "aminos", "tomatillos", "chilies", "chiles", "flakes", "clams", "mussels",
  "shrimp", "scallops", "anchovies", "sardines", "lentils", "berries",
  "thighs", "breasts", "wings", "legs", "drumsticks", "chops", "ribs", "cutlets",
];
