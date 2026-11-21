// Prompts for importing and generating recipes. The ingredient rules match
// the app's naming rules (src/features/ingredients/utils, "cautious merge
// rule" in docs/ingredient-normalization.md); the app re-applies them after
// import, so these reduce mistakes rather than being the only guard.

import { type Category, describeCategories } from "./categories.ts";
import type { SourceContent } from "./sources.ts";

export const MAX_INPUT_CHARS = 120_000;

const ingredientRules = (categories: Category[]) => `
Ingredient rules:
- One entry per item you buy. Never combine items in one entry: "salt and pepper" is two entries ("salt", "black pepper"). Never use a placeholder such as "toppings", "seasonings", "vegetables" or "fresh herbs": list the actual items, or leave them out and add a warning.
- List only what you buy. Something made during the recipe from its other ingredients (a reduction, a jam, a sauce, a dressing, a filling) is not an ingredient: describe it in the instructions.
- ingredientName is only the item as it's sold, in lowercase: "garlic", "yellow onion", "black pepper", "cherry tomatoes".
- These go in notes, never in ingredientName: size ("large", "medium", "small"), freshness and state ("fresh", "freshly ground", "ripe", "softened", "melted", "room temperature", "warm"), preparation the cook does ("minced", "chopped", "diced", "sliced", "grated", "halved", "peeled", "cut into 1-inch cubes", "divided", "to taste", "for serving"), and brand names.
- Words that make it a different product stay in ingredientName: "diced tomatoes" (canned), "crushed tomatoes", "ground beef", "dried oregano", "shredded mozzarella", "unsalted butter", "low-sodium chicken broth", "toasted sesame oil", "red onion". If unsure whether a word changes what you'd buy, keep it in ingredientName.
- canonicalName is the most common grocery name for the same item when the recipe uses a regional name, synonym or misspelling ("scallions" → "green onion", "pak choi" → "bok choy", "heavy whipping cream" → "heavy cream", "coriander leaves" → "cilantro"). Otherwise it equals ingredientName. Never change it to a different product: "salted butter" stays "salted butter", "ground coriander" stays "ground coriander". Never make it broader by leaving out words that change what you buy (cut, bone, skin, variety, form): "boneless skinless chicken breasts" stays "boneless skinless chicken breasts", not "chicken breasts"; "flat-leaf parsley" stays "flat-leaf parsley", not "parsley".
- Alternatives ("olive or avocado oil", "1 cup butter or 3/4 cup oil"): the first option is the ingredient; every other option goes in substitutes as a full entry with its own quantity, unit and notes (repeat the main amount when the recipe doesn't give one). A vague alternative ("or other small pasta", "or your favorite cheese") goes in notes instead. Use substitutes: [] when there are none.
- quantity is a number or range as text ("2", "1 1/2", "2-3"). unit is one unit word ("cup", "tbsp", "tsp", "lb", "oz", "g", "ml", "clove", "can", "bunch") or "" when the item is counted ("2 eggs"). A container size goes in notes: "1 (15 oz) can black beans" is quantity "1", unit "can", notes "15 oz".
- When a quantity, unit, notes or other text value is missing, use an empty string "". Never write "null", "none" or "n/a".
- Every ingredient gets a category: the code of the grocery store department you'd find it in. "other" is only for non-food items. The departments:
${describeCategories(categories)}

Ingredient examples (input → entry):
- "2 large garlic cloves, minced" → {"ingredientName": "garlic", "canonicalName": "garlic", "quantity": "2", "unit": "clove", "notes": "large, minced", "category": "produce", "substitutes": []}
- "1 (14.5 oz) can diced tomatoes" → {"ingredientName": "diced tomatoes", "canonicalName": "diced tomatoes", "quantity": "1", "unit": "can", "notes": "14.5 oz", "category": "canned_jarred", "substitutes": []}
- "2 tbsp olive or avocado oil" → {"ingredientName": "olive oil", "canonicalName": "olive oil", "quantity": "2", "unit": "tbsp", "notes": "", "category": "oils_sauces_condiments", "substitutes": [{"ingredientName": "avocado oil", "canonicalName": "avocado oil", "quantity": "2", "unit": "tbsp", "notes": "", "category": "oils_sauces_condiments"}]}
- "3 scallions, thinly sliced" → {"ingredientName": "scallions", "canonicalName": "green onion", "quantity": "3", "unit": "", "notes": "thinly sliced", "category": "produce", "substitutes": []}
- "salt and freshly ground pepper to taste" → two entries: {"ingredientName": "salt", "notes": "to taste", …} and {"ingredientName": "black pepper", "notes": "freshly ground, to taste", …}
`;

// Tags are for browsing and filtering your own recipes. The kinds below are
// guidance, not a fixed list: any short tag that fits is fine.
const tagRules = `
Tag rules:
- Tags help someone browse and filter their own recipes. Give a handful of short, lowercase tags that describe the dish, usually 3 to 6.
- Useful kinds of tags, with examples (not a fixed list; use any tag that fits the dish):
  - meal or course: breakfast, lunch, dinner, dessert, snack, side, appetizer, drink
  - main protein or diet: chicken, beef, pork, seafood, vegetarian, vegan
  - cuisine: italian, mexican, american, thai, indian, mediterranean
  - cooking method or notable feature: no-bake, one-pot, slow cooker, air fryer, grill, sheet pan, quick, make-ahead, gluten-free
- If any ingredient needs to marinate or brine before cooking (in the instructions or the notes, for any length of time), always include the tag "marinate", in addition to the other tags. The home page shows it first so the cook knows to start ahead.
- Prefer general, reusable tags over the source page's search keywords: "easy dinner recipes", "creamy tortellini soup" or "chicken recipes" are better as "dinner", "soup" or "chicken". Don't repeat the title or list the ingredients as tags.
- Examples: tiramisu → ["dessert", "italian", "no-bake"]; chicken francese → ["dinner", "chicken", "italian"]; dutch oven beef stew → ["dinner", "beef", "stew", "one-pot", "comfort food"]; lamb kebabs marinated overnight → ["dinner", "lamb", "greek", "grill", "marinate"].`;

const recipeOutputRules = (categories: Category[]) => `
Rules:
- Do not invent exact quantities, times, or servings when extracting from a source. Leave them empty when missing (use null for the number fields).
- Preserve user modifications from notes over website defaults.
- Keep instructions text-first and compact. Format instructions as newline-separated numbered steps: "1. ...\\n2. ...\\n3. ...". Do not return all steps in one paragraph.
- Instructions must be fully self-contained. Never write "according to the source recipe", "follow the source recipe", "see source", "as directed", "per package", or any wording that requires opening the URL.
- If a source step references another recipe, package, video, or external page, rewrite it into direct cooking instructions using the available text. If details are unavailable, state the missing detail plainly in warnings instead of referencing the source.
- Include ingredient details directly in the steps when needed. A user must be able to cook from the saved recipe without visiting sourceUrl.
- Add warnings for inaccessible URLs, missing details, social/video links that could not be read, or low-confidence extraction.
${tagRules}
${ingredientRules(categories)}`;

export const buildImportPrompt = (notes: string, sources: SourceContent[], categories: Category[]): string => {
  const sourceText = sources
    .map(
      (source, index) => `
SOURCE ${index + 1}
URL: ${source.url}
TITLE: ${source.title || "unknown"}
TEXT:
${source.text || source.warning || "No readable text."}`
    )
    .join("\n\n");

  return `
You are extracting personal recipes for PlanMyMeals.

Return concise JSON matching the provided schema. Extract every distinct recipe from the notes and fetched sources. A heading followed by a URL belongs to the same recipe when they are adjacent. Notes after a URL should modify that recipe when clearly related.

${recipeOutputRules(categories)}
- Use sourceUrl for the most relevant URL for each recipe.

USER NOTES:
${notes.slice(0, MAX_INPUT_CHARS)}

FETCHED SOURCES:
${sourceText}
`;
};

export const buildGeneratePrompt = (requestText: string, categories: Category[]): string => `
You are generating personal recipe drafts for PlanMyMeals.

Return concise JSON matching the provided schema. Generate every distinct recipe requested by the user. If the user asks for multiple recipes, return multiple objects in recipes.

Generation rules:
- Generate complete, cookable recipes with realistic ingredients, quantities, timings, servings, and instructions.
- Use sourceUrl: null for generated recipes.
- Respect requested ingredients, dislikes, cuisine, diet, equipment, budget, prep time, servings, and number of recipes.
- If the user gives vague constraints, make reasonable practical choices and add a short warning explaining assumptions.
${recipeOutputRules(categories)}

USER REQUEST:
${requestText.slice(0, MAX_INPUT_CHARS)}
`;
