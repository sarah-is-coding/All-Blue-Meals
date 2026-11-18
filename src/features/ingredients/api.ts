import { supabase } from "../../lib/supabaseClient";
import type { Tables } from "../../lib/db/database.types";
import type { Ingredient, IngredientCategory, IngredientMatch } from "./types";
import { dropsWords, ingredientKey, singularDisplayName } from "./utils/ingredientKey";

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
  category: row.category as Ingredient["category"],
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
export async function searchIngredients(term: string, limit = 8): Promise<IngredientMatch[]> {
  const trimmed = term.trim().toLowerCase();
  if (!trimmed) {
    return [];
  }
  const key = ingredientKey(trimmed);

  const nameFilter = `name.ilike.${quoteFilterValue(`%${escapeLikePattern(trimmed)}%`)}`;
  const keyFilter = key ? `,name_key.ilike.${quoteFilterValue(`%${key}%`)}` : "";

  const [direct, aliases] = await Promise.all([
    supabase
      .from("ingredients")
      .select(INGREDIENT_COLUMNS)
      .or(`${nameFilter}${keyFilter}`)
      .order("name", { ascending: true })
      .limit(limit)
      .returns<IngredientRow[]>(),
    key
      ? supabase
          .from("ingredient_aliases")
          .select(ALIAS_COLUMNS)
          .eq("status", "approved")
          .ilike("alias_key", `%${key}%`)
          .limit(limit)
          .returns<AliasRow[]>()
      : Promise.resolve({ data: [] as AliasRow[], error: null }),
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
 * Link names to their canonical ingredient through ingredient_aliases (rule
 * in docs/ingredient-normalization.md, "AI-created aliases"): when the
 * canonical ingredient exists in the same category the alias is approved and
 * the name resolves to it now; in a different category, or when the canonical
 * name only leaves words out, it's saved as pending for review and the name
 * is created as written. Aliases are best effort: a
 * failure never stops a recipe from saving.
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

    const aliases = candidates.flatMap(([key, request]) => {
      const canonical = canonicals.get(ingredientKey(request.canonicalName ?? ""));
      if (!canonical) return [];
      // A canonical name that only drops words ("chicken breasts" for
      // "skinless boneless chicken breasts") is a broader item: pending.
      const approved = canonical.category === request.category && !dropsWords(request.name, canonical.name);
      if (approved) found.set(key, canonical);
      return [{
        alias_key: key,
        alias_name: request.name.trim().toLowerCase(),
        ingredient_id: canonical.id,
        source: "ai",
        status: approved ? "approved" : "pending",
      }];
    });
    if (aliases.length > 0) {
      // An alias someone else just added for the same name is fine to keep.
      await supabase
        .from("ingredient_aliases")
        .upsert(aliases, { onConflict: "alias_key", ignoreDuplicates: true });
    }
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
