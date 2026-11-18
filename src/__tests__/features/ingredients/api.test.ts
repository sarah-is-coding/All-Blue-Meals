import {
  createIngredient,
  findIngredientMatches,
  escapeLikePattern,
  resolveIngredients,
  searchIngredients,
} from "../../../features/ingredients/api";

// Behavior changed in step 2 of docs/ingredient-normalization.md: matching
// moved from an exact lowercase name to ingredientKey() (case, accents,
// punctuation, spaces and plurals ignored) plus the ingredient_aliases
// table, and new ingredients are created in one batch with their key.

// ─────────────────────────────────────────────────────────────
// Supabase chainable mock: every method returns the builder;
// `.returns()` is the terminal call and resolves per test.
// ─────────────────────────────────────────────────────────────
vi.mock("../../../lib/supabaseClient", () => {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ["from", "select", "insert", "upsert", "eq", "ilike", "or", "in", "order", "limit"]) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }
  builder.returns = vi.fn().mockResolvedValue({ data: [], error: null });
  return { supabase: builder };
});

import { supabase } from "../../../lib/supabaseClient";

const db = supabase as unknown as Record<string, ReturnType<typeof vi.fn>>;

const row = (id: string, name: string, nameKey: string | null, category = "produce") => ({
  id,
  name,
  name_key: nameKey,
  category,
  default_unit: null,
});

const ok = (data: unknown) => ({ data, error: null });

beforeEach(() => {
  vi.clearAllMocks();
  for (const method of ["from", "select", "insert", "upsert", "eq", "ilike", "or", "in", "order", "limit"]) {
    db[method].mockReturnValue(db);
  }
  db.returns.mockResolvedValue(ok([]));
});

describe("escapeLikePattern", () => {
  it("escapes LIKE wildcards and backslashes", () => {
    expect(escapeLikePattern("50%_off\\")).toBe("50\\%\\_off\\\\");
  });

  it("leaves plain text alone", () => {
    expect(escapeLikePattern("olive oil")).toBe("olive oil");
    expect(escapeLikePattern("")).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────
// searchIngredients
// ─────────────────────────────────────────────────────────────
describe("searchIngredients", () => {
  it("returns an empty array without querying when the term is empty", async () => {
    expect(await searchIngredients("   ")).toEqual([]);
    expect(db.from).not.toHaveBeenCalled();
  });

  it("matches the name or the key, and searches approved aliases", async () => {
    await searchIngredients("Jalapeños");

    expect(db.from).toHaveBeenCalledWith("ingredients");
    expect(db.or).toHaveBeenCalledWith('name.ilike."%jalapeños%",name_key.ilike."%jalapeno%"');
    expect(db.order).toHaveBeenCalledWith("name", { ascending: true });
    expect(db.limit).toHaveBeenCalledWith(8);

    expect(db.from).toHaveBeenCalledWith("ingredient_aliases");
    expect(db.eq).toHaveBeenCalledWith("status", "approved");
    expect(db.ilike).toHaveBeenCalledWith("alias_key", "%jalapeno%");
  });

  it("escapes wildcards and quotes the value so commas can't break the filter", async () => {
    await searchIngredients('50% "dark", chocolate');
    expect(db.or).toHaveBeenCalledWith(
      'name.ilike."%50\\\\% \\"dark\\", chocolate%",name_key.ilike."%50darkchocolate%"'
    );
  });

  it("returns direct and alias matches, exact key matches first, without duplicates", async () => {
    db.returns
      .mockResolvedValueOnce(
        ok([row("i-2", "green onion sauce", "greenonionsauce"), row("i-1", "green onion", "greenonion")])
      )
      .mockResolvedValueOnce(
        ok([
          { alias_key: "scallion", alias_name: "scallions", ingredients: row("i-1", "green onion", "greenonion") },
          { alias_key: "scallionoil", alias_name: "scallion oil", ingredients: row("i-3", "chili oil", "chilioil") },
        ])
      );

    const results = await searchIngredients("scallion");

    expect(results).toEqual([
      { id: "i-3", name: "chili oil", category: "produce", defaultUnit: null, matchedAlias: "scallion oil" },
      { id: "i-1", name: "green onion", category: "produce", defaultUnit: null, matchedAlias: null },
      { id: "i-2", name: "green onion sauce", category: "produce", defaultUnit: null, matchedAlias: null },
    ]);
  });

  it("puts an exact key match before other matches", async () => {
    db.returns
      .mockResolvedValueOnce(ok([row("a", "onion powder", "onionpowder"), row("b", "onion", "onion")]))
      .mockResolvedValueOnce(ok([]));

    const results = await searchIngredients("Onions");
    expect(results.map((r) => r.name)).toEqual(["onion", "onion powder"]);
  });

  it("applies a custom limit", async () => {
    await searchIngredients("oil", 3);
    expect(db.limit).toHaveBeenCalledWith(3);
  });

  it("throws when supabase returns an error", async () => {
    db.returns.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    await expect(searchIngredients("oil")).rejects.toThrow("boom");
  });
});

// ─────────────────────────────────────────────────────────────
// resolveIngredients / createIngredient
// ─────────────────────────────────────────────────────────────
describe("resolveIngredients", () => {
  it("returns an empty map without querying when there are no names", async () => {
    expect((await resolveIngredients([{ name: "  ", category: "other" }])).size).toBe(0);
    expect(db.from).not.toHaveBeenCalled();
  });

  it("finds existing ingredients by key without inserting", async () => {
    db.returns.mockResolvedValueOnce(ok([row("i-1", "onion", "onion")]));

    const result = await resolveIngredients([{ name: "Onions", category: "produce" }]);

    expect(db.in).toHaveBeenCalledWith("name_key", ["onion"]);
    expect(db.insert).not.toHaveBeenCalled();
    expect(result.get("onion")).toEqual({ id: "i-1", name: "onion", category: "produce", defaultUnit: null });
  });

  it("uses the oldest row when duplicates share a key", async () => {
    db.returns.mockResolvedValueOnce(ok([row("old", "onion", "onion"), row("new", "onions", "onion")]));
    const result = await resolveIngredients([{ name: "onion", category: "produce" }]);
    expect(db.order).toHaveBeenCalledWith("created_at", { ascending: true });
    expect(result.get("onion")?.id).toBe("old");
  });

  it("falls back to an approved alias when no name has the key", async () => {
    db.returns
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(
        ok([{ alias_key: "scallion", alias_name: "scallions", ingredients: row("i-1", "green onion", "greenonion") }])
      );

    const result = await resolveIngredients([{ name: "scallions", category: "produce" }]);

    expect(db.from).toHaveBeenCalledWith("ingredient_aliases");
    expect(db.eq).toHaveBeenCalledWith("status", "approved");
    expect(db.in).toHaveBeenCalledWith("alias_key", ["scallion"]);
    expect(db.insert).not.toHaveBeenCalled();
    expect(result.get("scallion")?.name).toBe("green onion");
  });

  it("falls back to the exact name for rows saved before keys existed", async () => {
    db.returns
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok([row("i-9", "tomato", null)]));

    const result = await resolveIngredients([{ name: "Tomatoes", category: "produce" }]);

    // Both the name as written and the singular name a new row would get.
    expect(db.in).toHaveBeenCalledWith("name", ["tomatoes", "tomato"]);
    expect(db.insert).not.toHaveBeenCalled();
    expect(result.get("tomato")?.id).toBe("i-9");
  });

  it("creates every missing ingredient in one insert, with singular name, key and category", async () => {
    db.returns
      .mockResolvedValueOnce(ok([row("i-1", "garlic", "garlic")]))
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(
        ok([row("n-1", "shallot", "shallot"), row("n-2", "black beans", "blackbean", "pantry")])
      );

    const result = await resolveIngredients([
      { name: "garlic", category: "produce" },
      { name: "Shallots", category: "produce" },
      { name: "black beans", category: "pantry" },
      { name: "shallot", category: "other" }, // same key as "Shallots": asked for once
    ]);

    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(db.insert).toHaveBeenCalledWith([
      { name: "shallot", name_key: "shallot", category: "produce" },
      { name: "black beans", name_key: "blackbean", category: "pantry" },
    ]);
    expect([...result.keys()].sort()).toEqual(["blackbean", "garlic", "shallot"]);
  });

  it("looks again when a concurrent insert created the ingredient first", async () => {
    db.returns
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce({ data: null, error: { code: "23505", message: "duplicate key" } })
      .mockResolvedValueOnce(ok([row("i-1", "leek", "leek")]));

    const result = await resolveIngredients([{ name: "leeks", category: "produce" }]);
    expect(result.get("leek")?.id).toBe("i-1");
  });

  it("throws other insert errors", async () => {
    db.returns
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce({ data: null, error: { code: "42501", message: "permission denied" } });

    await expect(resolveIngredients([{ name: "leek", category: "produce" }])).rejects.toThrow(
      "permission denied"
    );
  });
});

describe("createIngredient", () => {
  it("throws when the name is empty", async () => {
    await expect(createIngredient("  ")).rejects.toThrow("Ingredient name is required.");
  });

  it("returns the existing ingredient for a variant spelling", async () => {
    db.returns.mockResolvedValueOnce(ok([row("i-1", "all-purpose flour", "allpurposeflour", "pantry")]));
    const ingredient = await createIngredient("All Purpose Flour", "pantry");
    expect(ingredient).toEqual({ id: "i-1", name: "all-purpose flour", category: "pantry", defaultUnit: null });
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("creates a new ingredient with 'other' as the default category", async () => {
    db.returns
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok([row("n-1", "sumac", "sumac", "other")]));

    const ingredient = await createIngredient("  Sumac ");

    expect(db.insert).toHaveBeenCalledWith([{ name: "sumac", name_key: "sumac", category: "other" }]);
    expect(ingredient.id).toBe("n-1");
  });
});

// ─────────────────────────────────────────────────────────────
// AI canonical names → ingredient_aliases (step 5)
// ─────────────────────────────────────────────────────────────
describe("resolveIngredients with a canonical name", () => {
  it("uses the canonical ingredient and adds an approved alias when the category matches", async () => {
    db.returns
      .mockResolvedValueOnce(ok([])) // "scallions" by key
      .mockResolvedValueOnce(ok([])) // by alias
      .mockResolvedValueOnce(ok([])) // by name
      .mockResolvedValueOnce(ok([row("i-1", "green onion", "greenonion", "produce")])); // canonical by key

    const result = await resolveIngredients([
      { name: "Scallions", category: "produce", canonicalName: "green onion" },
    ]);

    expect(result.get("scallion")?.id).toBe("i-1");
    expect(db.upsert).toHaveBeenCalledWith(
      [{ alias_key: "scallion", alias_name: "scallions", ingredient_id: "i-1", source: "ai", status: "approved" }],
      { onConflict: "alias_key", ignoreDuplicates: true }
    );
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("saves a pending alias and creates the name as written when the category differs", async () => {
    db.returns
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok([row("i-1", "butter", "butter", "dairy & eggs")]))
      .mockResolvedValueOnce(ok([row("n-1", "ghee", "ghee", "pantry")]));

    const result = await resolveIngredients([{ name: "ghee", category: "pantry", canonicalName: "butter" }]);

    expect(db.upsert).toHaveBeenCalledWith(
      [expect.objectContaining({ alias_key: "ghee", ingredient_id: "i-1", status: "pending" })],
      expect.anything()
    );
    expect(db.insert).toHaveBeenCalledWith([{ name: "ghee", name_key: "ghee", category: "pantry" }]);
    expect(result.get("ghee")?.id).toBe("n-1");
  });

  // Found on the Chicken Francese import: the AI gave "chicken breasts" for
  // "skinless boneless chicken breasts", which made the grocery list lose
  // words that change what you buy.
  it("saves a pending alias and creates the name as written when the canonical name only drops words", async () => {
    db.returns
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok([row("i-1", "chicken breasts", "chickenbreast", "meat & seafood")]))
      .mockResolvedValueOnce(ok([row("n-1", "skinless boneless chicken breasts", "skinlessbonelesschickenbreast", "meat & seafood")]));

    await resolveIngredients([
      { name: "skinless boneless chicken breasts", category: "meat & seafood", canonicalName: "chicken breasts" },
    ]);

    expect(db.upsert).toHaveBeenCalledWith(
      [expect.objectContaining({ alias_key: "skinlessbonelesschickenbreast", ingredient_id: "i-1", status: "pending" })],
      expect.anything()
    );
    expect(db.insert).toHaveBeenCalledWith([
      { name: "skinless boneless chicken breasts", name_key: "skinlessbonelesschickenbreast", category: "meat & seafood" },
    ]);
  });

  it("adds no alias when the canonical name isn't in the catalog", async () => {
    // Name: by key, alias, exact name; canonical: by key, alias, exact name; then the insert.
    for (let lookup = 0; lookup < 6; lookup += 1) db.returns.mockResolvedValueOnce(ok([]));
    db.returns.mockResolvedValueOnce(ok([row("n-1", "pak choi", "pakchoi")]));

    await resolveIngredients([{ name: "pak choi", category: "produce", canonicalName: "bok choy" }]);

    expect(db.upsert).not.toHaveBeenCalled();
    expect(db.insert).toHaveBeenCalledWith([{ name: "pak choi", name_key: "pakchoi", category: "produce" }]);
  });

  it("ignores a canonical name with the same key as the name", async () => {
    db.returns.mockResolvedValueOnce(ok([row("i-1", "onion", "onion")]));
    await resolveIngredients([{ name: "onions", category: "produce", canonicalName: "Onion" }]);
    expect(db.upsert).not.toHaveBeenCalled();
  });

  it("still saves when adding the alias fails", async () => {
    db.returns
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok([row("i-1", "green onion", "greenonion", "produce")]));
    db.upsert.mockRejectedValueOnce(new Error("network"));

    const result = await resolveIngredients([
      { name: "scallions", category: "produce", canonicalName: "green onion" },
    ]);
    expect(result.get("scallion")?.id).toBe("i-1");
  });
});

describe("findIngredientMatches", () => {
  it("looks names up by key without creating anything", async () => {
    db.returns.mockResolvedValueOnce(ok([row("i-1", "onion", "onion")])).mockResolvedValue(ok([]));

    const matches = await findIngredientMatches(["Onions", "sumac", "onion"]);

    expect(db.in).toHaveBeenCalledWith("name_key", ["onion", "sumac"]);
    expect(matches.get("onion")?.id).toBe("i-1");
    expect(matches.has("sumac")).toBe(false);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("returns an empty map without querying for no names", async () => {
    expect((await findIngredientMatches(["  "])).size).toBe(0);
    expect(db.from).not.toHaveBeenCalled();
  });
});
