// Checking what comes into and out of the import function. The request body,
// the categories response, and above all the model's output are untrusted:
// each is narrowed from `unknown` here instead of being cast.
//
// Recipes are trimmed to the database's text limits (decision D2 in
// principles/evaluations/2026-11-24-plan.md), so an imported draft can always
// be saved. The app reads recipes as ImportedRecipe in
// src/features/recipes/types.ts; keep the shapes in step.
//
// No Deno globals here, so the app's tests (Vitest) can import this module.

export type RequestMode = "import" | "generate";

export type ImportRequest = { mode: RequestMode; text: string };

export type Category = { id: string; name: string; description: string };

type IngredientOption = {
  ingredientName: string;
  canonicalName: string;
  quantity: string;
  unit: string;
  notes: string;
  category: string | null;
};

export type ImportedIngredient = IngredientOption & { substitutes: IngredientOption[] };

export type ImportedRecipe = {
  title: string;
  description: string;
  sourceUrl: string | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  servings: number | null;
  tags: string[];
  instructions: string;
  ingredients: ImportedIngredient[];
  confidence: "high" | "medium" | "low";
  warnings: string[];
};

/** The database's text limits (D2), applied to drafts before they're returned. */
export const LIMITS = {
  title: 200,
  description: 2_000,
  instructions: 20_000,
  sourceUrl: 2_048,
  tags: 30,
  tag: 40,
  ingredientName: 120,
  quantity: 50,
  unit: 50,
  ingredientNotes: 500,
  ingredients: 100,
  warning: 300,
} as const;

/** The request text is capped well above what a prompt uses (MAX_INPUT_CHARS). */
export const MAX_REQUEST_CHARS = 200_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown, max: number): string =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const wholeNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 10_000 ? value : null;

const textList = (value: unknown, maxItems: number, maxLength: number): string[] =>
  Array.isArray(value)
    ? value.map((item) => text(item, maxLength)).filter(Boolean).slice(0, maxItems)
    : [];

/** The request body, or a message for the person when it's not usable. */
export function parseImportRequest(body: unknown): ImportRequest | { error: string } {
  if (!isRecord(body)) return { error: "Send the recipe text as JSON." };
  const mode: RequestMode = body.mode === "generate" ? "generate" : "import";
  const requestText = typeof body.text === "string" ? body.text.trim() : "";
  if (!requestText) {
    return {
      error:
        mode === "generate"
          ? "Describe the recipe or recipes you want to generate."
          : "Paste recipe notes, links, or both.",
    };
  }
  if (requestText.length > MAX_REQUEST_CHARS) {
    return { error: "That's too much text to import at once. Try fewer recipes." };
  }
  return { mode, text: requestText };
}

/** The ingredient_categories rows, keeping only well-formed ones. */
export function parseCategories(json: unknown): Category[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((row) =>
    isRecord(row) && typeof row.id === "string" && typeof row.name === "string"
      ? [{ id: row.id, name: row.name, description: typeof row.description === "string" ? row.description : "" }]
      : []
  );
}

const sanitizeOption = (value: unknown, categoryCodes: ReadonlySet<string>): IngredientOption | null => {
  if (!isRecord(value)) return null;
  const ingredientName = text(value.ingredientName, LIMITS.ingredientName);
  if (!ingredientName) return null;
  const category = typeof value.category === "string" && categoryCodes.has(value.category) ? value.category : null;
  return {
    ingredientName,
    canonicalName: text(value.canonicalName, LIMITS.ingredientName) || ingredientName,
    quantity: text(value.quantity, LIMITS.quantity),
    unit: text(value.unit, LIMITS.unit),
    notes: text(value.notes, LIMITS.ingredientNotes),
    category,
  };
};

const sanitizeIngredient = (value: unknown, categoryCodes: ReadonlySet<string>): ImportedIngredient | null => {
  const option = sanitizeOption(value, categoryCodes);
  if (!option || !isRecord(value)) return null;
  const substitutes = Array.isArray(value.substitutes)
    ? value.substitutes.flatMap((substitute) => sanitizeOption(substitute, categoryCodes) ?? [])
    : [];
  return { ...option, substitutes };
};

const sanitizeSourceUrl = (value: unknown): string | null => {
  if (typeof value !== "string" || value.length > LIMITS.sourceUrl) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
};

const sanitizeRecipe = (value: unknown, categoryCodes: ReadonlySet<string>): ImportedRecipe | null => {
  if (!isRecord(value)) return null;
  const title = text(value.title, LIMITS.title);
  if (!title) return null;
  const ingredients = Array.isArray(value.ingredients)
    ? value.ingredients.flatMap((ingredient) => sanitizeIngredient(ingredient, categoryCodes) ?? [])
    : [];
  const servings = wholeNumber(value.servings);
  return {
    title,
    description: text(value.description, LIMITS.description),
    sourceUrl: sanitizeSourceUrl(value.sourceUrl),
    prepMinutes: wholeNumber(value.prepMinutes),
    cookMinutes: wholeNumber(value.cookMinutes),
    servings: servings === 0 ? null : servings,
    tags: textList(value.tags, LIMITS.tags, LIMITS.tag),
    instructions: text(value.instructions, LIMITS.instructions),
    ingredients: ingredients.slice(0, LIMITS.ingredients),
    confidence: value.confidence === "high" || value.confidence === "medium" ? value.confidence : "low",
    warnings: textList(value.warnings, 20, LIMITS.warning),
  };
};

/**
 * The model's parsed JSON as drafts the app can use. Anything that isn't a
 * recipe with a title is dropped, with a warning so the person knows.
 */
export function sanitizeImportResult(
  json: unknown,
  categoryCodes: readonly string[]
): { recipes: ImportedRecipe[]; warnings: string[] } {
  const codes = new Set(categoryCodes);
  const rawRecipes = isRecord(json) && Array.isArray(json.recipes) ? json.recipes : [];
  const recipes = rawRecipes.flatMap((recipe) => sanitizeRecipe(recipe, codes) ?? []);
  const warnings = isRecord(json) ? textList(json.warnings, 20, LIMITS.warning) : [];
  const dropped = rawRecipes.length - recipes.length;
  if (dropped > 0) {
    warnings.push(
      dropped === 1
        ? "One recipe couldn't be read and was left out."
        : `${dropped} recipes couldn't be read and were left out.`
    );
  }
  return { recipes, warnings };
}
