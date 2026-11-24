import { supabase } from "../../lib/supabaseClient";
import type { Tables } from "../../lib/db/database.types";
import { upgradeIngredientCategory } from "./categories/api";
import { toCategoryCode } from "./categories/codes";
import type { Ingredient, IngredientCategory, IngredientMatch } from "./types";
import { ingredientKey, isSafeSynonym, singularDisplayName } from "./utils/ingredientKey";

// Matching follows docs/ingredient-normalization.md: a name matches an
// ingredient when their keys match (ingredientKey ignores case, accents,
// punctuation, spaces and plurals), or through an approved row in
// ingredient_aliases ("scallions" → green onion). Every ingredient has a
// unique name_key (step 8).

type IngredientRow = Pick<Tables<"ingredients">, "id" | "name" | "name_key" | "category" | "default_unit">;

type AliasRow = Pick<Tables<"ingredient_aliases">, "alias_key" | "alias_name"> & {
  ingredients: IngredientRow | null;
};

const INGREDIENT_COLUMNS = "id,name,name_key,category,default_unit";
const ALIAS_COLUMNS = `alias_key,alias_name,ingredients(${INGREDIENT_COLUMNS})`;

const mapIngredientRow = (row: IngredientRow): Ingredient => ({
  id: row.id,
  name: row.name,
  category: toCategoryCode(row.category),
  defaultUnit: row.default_unit,
});

/** Escape LIKE wildcards so "%" and "_" typed by the user match literally. */
export const escapeLikePattern = (text: string): string => text.replace(/[\\%_]/g, "\\$&");

/** Quote a value for a PostgREST `.or()` filter, so commas and parentheses can't break it. */
const quoteFilterValue = (value: string): string => `"${value.replace(/["\\]/g, "\\$&")}"`;

const throwIfError = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

// ── Search ──────────────────────────────────────────────────────────────────

const rankMatch = (match: IngredientMatch, key: string, term: string): number => {
  if (ingredientKey(match.matchedAlias ?? match.name) === key) return 0;
  if (match.name.startsWith(term)) return 1;
  return 2;
};

/**
 * Ingredients whose name or key contains the typed text, plus ingredients
 * reached through an approved alias (returned with `matchedAlias` set).
 * Exact key matches come first.
 */
export async function searchIngredients(
  term: string,
  limit = 8,
  /** Cancels the search when the typed text has moved on. */
  options: { signal?: AbortSignal } = {}
): Promise<IngredientMatch[]> {
  const trimmed = term.trim().toLowerCase();
  if (!trimmed) {
    return [];
  }
  const key = ingredientKey(trimmed);

  const nameFilter = `name.ilike.${quoteFilterValue(`%${escapeLikePattern(trimmed)}%`)}`;
  const keyFilter = key ? `,name_key.ilike.${quoteFilterValue(`%${key}%`)}` : "";

  let directQuery = supabase
    .from("ingredients")
    .select(INGREDIENT_COLUMNS)
    .or(`${nameFilter}${keyFilter}`)
    .order("name", { ascending: true })
    .limit(limit);
  if (options.signal) directQuery = directQuery.abortSignal(options.signal);

  const aliasQuery = () => {
    let query = supabase
      .from("ingredient_aliases")
      .select(ALIAS_COLUMNS)
      .eq("status", "approved")
      .ilike("alias_key", `%${key}%`)
      .limit(limit);
    if (options.signal) query = query.abortSignal(options.signal);
    return query.returns<AliasRow[]>();
  };

  const [direct, aliases] = await Promise.all([
    directQuery.returns<IngredientRow[]>(),
    key ? aliasQuery() : Promise.resolve({ data: [] as AliasRow[], error: null }),
  ]);
  throwIfError(direct.error);
  throwIfError(aliases.error);

  const matches = new Map<string, IngredientMatch>();
  for (const row of direct.data ?? []) {
    matches.set(row.id, { ...mapIngredientRow(row), matchedAlias: null });
  }
  for (const row of aliases.data ?? []) {
    if (row.ingredients && !matches.has(row.ingredients.id)) {
      matches.set(row.ingredients.id, {
        ...mapIngredientRow(row.ingredients),
        matchedAlias: row.alias_name,
      });
    }
  }

  return [...matches.values()]
    .sort((a, b) => rankMatch(a, key, trimmed) - rankMatch(b, key, trimmed) || a.name.localeCompare(b.name))
    .slice(0, limit);
}

// ── Resolve and create ──────────────────────────────────────────────────────

export type IngredientRequest = {
  name: string;
  category: IngredientCategory;
  /** From AI import: the common name for the same item ("scallions" → "green onion"). */
  canonicalName?: string | null;
};

/**
 * Link names to their canonical ingredient through ingredient_aliases ("AI-
 * created aliases" in docs/ingredient-normalization.md). Decided
 * automatically, with no review queue: when the canonical ingredient exists
 * in the same category and the two names are safe synonyms (isSafeSynonym),
 * the alias is added and the name resolves to it now. Otherwise nothing is
 * saved and the name is created as written, so the worst case is a
 * duplicate, never a wrong merge. The database function re-checks the same
 * rules. Best effort: a failure never stops a recipe from saving.
 */
const linkCanonicalNames = async (
  requests: Map<string, IngredientRequest>,
  found: Map<string, Ingredient>
): Promise<void> => {
  const candidates = [...requests.entries()].filter(
    ([key, request]) => !found.has(key) && request.canonicalName && ingredientKey(request.canonicalName) !== key
  );
  if (candidates.length === 0) return;

  try {
    const canonicalRequests = new Map(
      candidates.map(([, request]) => [
        ingredientKey(request.canonicalName ?? ""),
        { name: request.canonicalName ?? "", category: request.category },
      ])
    );
    const canonicals = await findByKeys(canonicalRequests);

    await Promise.all(
      candidates.map(async ([key, request]) => {
        const canonical = canonicals.get(ingredientKey(request.canonicalName ?? ""));
        const safe =
          canonical !== undefined &&
          canonical.category === request.category &&
          isSafeSynonym(request.name, canonical.name);
        if (!safe) return;
        const { data: linked, error } = await supabase.rpc("add_ingredient_alias", {
          p_alias_key: key,
          p_alias_name: request.name.trim(),
          p_ingredient_id: canonical.id,
          p_category: request.category,
        });
        if (!error && linked === true) found.set(key, canonical);
      })
    );
  } catch {
    // Best effort: without the alias, the name is simply created as written.
  }
};

/** Existing ingredients for the given keys: by name_key (unique), then approved alias. */
const findByKeys = async (requests: Map<string, IngredientRequest>): Promise<Map<string, Ingredient>> => {
  const found = new Map<string, Ingredient>();
  const missing = () => [...requests.keys()].filter((key) => !found.has(key));

  const { data: byKey, error: keyError } = await supabase
    .from("ingredients")
    .select(INGREDIENT_COLUMNS)
    .in("name_key", missing())
    .returns<IngredientRow[]>();
  throwIfError(keyError);
  for (const row of byKey ?? []) {
    found.set(row.name_key, mapIngredientRow(row));
  }

  if (missing().length > 0) {
    const { data: byAlias, error: aliasError } = await supabase
      .from("ingredient_aliases")
      .select(ALIAS_COLUMNS)
      .eq("status", "approved")
      .in("alias_key", missing())
      .returns<AliasRow[]>();
    throwIfError(aliasError);
    for (const row of byAlias ?? []) {
      if (row.ingredients) found.set(row.alias_key, mapIngredientRow(row.ingredients));
    }
  }

  return found;
};

/**
 * A matched ingredient with no real category ("other") takes the one this
 * request brings (step 9): otherwise "other" was permanent, since clients
 * can't update the shared catalog. The database only ever upgrades such rows.
 */
const upgradeCategories = async (
  requests: Map<string, IngredientRequest>,
  found: Map<string, Ingredient>
): Promise<void> => {
  const upgrades = [...found.entries()].flatMap(([key, ingredient]) => {
    const category = requests.get(key)?.category;
    const uncategorized = ingredient.category === null || ingredient.category === "other";
    return category && category !== "other" && uncategorized ? [{ key, ingredient, category }] : [];
  });
  await Promise.all(
    upgrades.map(async ({ key, ingredient, category }) => {
      if (await upgradeIngredientCategory(ingredient.id, category)) found.set(key, { ...ingredient, category });
    })
  );
};

/**
 * Find or create the catalog ingredient for each name, in a few requests
 * for the whole list. Returns a map from ingredientKey(name) to the
 * ingredient. New ingredients get their singular display name and key.
 */
export async function resolveIngredients(
  requests: ReadonlyArray<IngredientRequest>
): Promise<Map<string, Ingredient>> {
  const byKey = new Map<string, IngredientRequest>();
  for (const request of requests) {
    const key = ingredientKey(request.name);
    if (key && !byKey.has(key)) byKey.set(key, request);
  }
  if (byKey.size === 0) return new Map();

  const found = await findByKeys(byKey);
  await linkCanonicalNames(byKey, found);
  await upgradeCategories(byKey, found);
  const toCreate = [...byKey.entries()].filter(([key]) => !found.has(key));
  if (toCreate.length === 0) return found;

  const { data: created, error } = await supabase
    .from("ingredients")
    .insert(
      toCreate.map(([key, request]) => ({
        name: singularDisplayName(request.name),
        name_key: key,
        category: request.category,
      }))
    )
    .select(INGREDIENT_COLUMNS)
    .returns<IngredientRow[]>();

  if (error) {
    // Someone added one of these at the same moment: look them up again.
    if (error.code === "23505" || error.message.includes("duplicate key")) {
      const retried = await findByKeys(new Map(toCreate));
      for (const [key, ingredient] of retried) found.set(key, ingredient);
      if (toCreate.every(([key]) => found.has(key))) return found;
    }
    throw new Error(error.message);
  }

  for (const row of created ?? []) {
    found.set(row.name_key, mapIngredientRow(row));
  }
  return found;
}

/**
 * Which of these names already exist in the catalog (by key or approved
 * alias), without creating anything. Map from ingredientKey(name) to the
 * ingredient; names not in the map would be new.
 */
export async function findIngredientMatches(names: ReadonlyArray<string>): Promise<Map<string, Ingredient>> {
  const requests = new Map<string, IngredientRequest>();
  for (const name of names) {
    const key = ingredientKey(name);
    if (key && !requests.has(key)) requests.set(key, { name, category: "other" });
  }
  return requests.size > 0 ? findByKeys(requests) : new Map();
}

/** Find or create one ingredient. */
export async function createIngredient(
  name: string,
  category: IngredientCategory = "other"
): Promise<Ingredient> {
  const key = ingredientKey(name);
  if (!key) {
    throw new Error("Ingredient name is required.");
  }
  const ingredient = (await resolveIngredients([{ name, category }])).get(key);
  if (!ingredient) {
    throw new Error("Couldn't save that ingredient. Try again.");
  }
  return ingredient;
}
