import {
  LIMITS,
  MAX_REQUEST_CHARS,
  parseCategories,
  parseImportRequest,
  sanitizeImportResult,
} from "../../../../../supabase/functions/import-recipes/validate.ts";

const CODES = ["produce", "dairy", "other"];

const ingredient = (overrides: Record<string, unknown> = {}) => ({
  ingredientName: "garlic",
  canonicalName: "garlic",
  quantity: "2",
  unit: "clove",
  notes: "minced",
  category: "produce",
  substitutes: [],
  ...overrides,
});

const recipe = (overrides: Record<string, unknown> = {}) => ({
  title: "Garlic Soup",
  description: "Cozy.",
  sourceUrl: "https://example.com/soup",
  prepMinutes: 10,
  cookMinutes: 30,
  servings: 4,
  tags: ["soup"],
  instructions: "Simmer.",
  ingredients: [ingredient()],
  confidence: "high",
  warnings: [],
  ...overrides,
});

describe("parseImportRequest", () => {
  it("reads the mode and trimmed text", () => {
    expect(parseImportRequest({ mode: "generate", text: "  3 dinners " })).toEqual({
      mode: "generate",
      text: "3 dinners",
    });
    expect(parseImportRequest({ text: "notes" })).toEqual({ mode: "import", text: "notes" });
  });

  it.each([
    ["a missing body", null, "Send the recipe text as JSON."],
    ["no text to import", { mode: "import", text: "  " }, "Paste recipe notes, links, or both."],
    ["no request to generate", { mode: "generate" }, "Describe the recipe or recipes you want to generate."],
    ["text that isn't a string", { text: 42 }, "Paste recipe notes, links, or both."],
  ])("explains %s", (_label, body, error) => {
    expect(parseImportRequest(body)).toEqual({ error });
  });

  it("refuses text far beyond what an import uses", () => {
    expect(parseImportRequest({ text: "x".repeat(MAX_REQUEST_CHARS + 1) })).toEqual({
      error: "That's too much text to import at once. Try fewer recipes.",
    });
  });
});

describe("parseCategories", () => {
  it("keeps well-formed rows and drops the rest", () => {
    expect(
      parseCategories([
        { id: "produce", name: "Produce", description: "Fresh vegetables" },
        { id: "dairy", name: "Dairy" },
        { id: 3, name: "Bad" },
        "nope",
      ])
    ).toEqual([
      { id: "produce", name: "Produce", description: "Fresh vegetables" },
      { id: "dairy", name: "Dairy", description: "" },
    ]);
  });

  it("returns nothing for a response that isn't a list", () => {
    expect(parseCategories({ message: "error" })).toEqual([]);
  });
});

describe("sanitizeImportResult", () => {
  it("keeps a well-formed recipe as it is", () => {
    expect(sanitizeImportResult({ recipes: [recipe()], warnings: ["Checked"] }, CODES)).toEqual({
      recipes: [recipe()],
      warnings: ["Checked"],
    });
  });

  it("drops anything that isn't a recipe with a title, and says so", () => {
    const result = sanitizeImportResult(
      { recipes: [recipe(), { title: "  " }, "soup", null], warnings: [] },
      CODES
    );
    expect(result.recipes).toHaveLength(1);
    expect(result.warnings).toEqual(["3 recipes couldn't be read and were left out."]);
  });

  it("returns no recipes for output that isn't the expected shape", () => {
    expect(sanitizeImportResult("not json", CODES)).toEqual({ recipes: [], warnings: [] });
    expect(sanitizeImportResult({ recipes: "soup" }, CODES)).toEqual({ recipes: [], warnings: [] });
  });

  // Drafts must fit the database's limits (decision D2), so they can be saved.
  it("trims text to the database's limits", () => {
    const [trimmed] = sanitizeImportResult(
      {
        recipes: [
          recipe({
            title: "T".repeat(500),
            instructions: "I".repeat(30_000),
            tags: Array.from({ length: 50 }, (_, i) => `tag-${i}-${"x".repeat(60)}`),
            ingredients: [ingredient({ ingredientName: "n".repeat(300), notes: "z".repeat(900) })],
          }),
        ],
      },
      CODES
    ).recipes;

    expect(trimmed.title).toHaveLength(LIMITS.title);
    expect(trimmed.instructions).toHaveLength(LIMITS.instructions);
    expect(trimmed.tags).toHaveLength(LIMITS.tags);
    expect(trimmed.tags.every((tag) => tag.length <= LIMITS.tag)).toBe(true);
    expect(trimmed.ingredients[0].ingredientName).toHaveLength(LIMITS.ingredientName);
    expect(trimmed.ingredients[0].notes).toHaveLength(LIMITS.ingredientNotes);
  });

  it("cleans up fields the model got wrong", () => {
    const [cleaned] = sanitizeImportResult(
      {
        recipes: [
          recipe({
            sourceUrl: "javascript:alert(1)",
            prepMinutes: -5,
            cookMinutes: 12.5,
            servings: 0,
            confidence: "certain",
            ingredients: [
              ingredient({ category: "spaceship", canonicalName: "" }),
              ingredient({ ingredientName: "" }),
              ingredient({ substitutes: [ingredient({ ingredientName: "shallot" }), { nope: true }] }),
            ],
          }),
        ],
      },
      CODES
    ).recipes;

    expect(cleaned).toMatchObject({
      sourceUrl: null,
      prepMinutes: null,
      cookMinutes: null,
      servings: null,
      confidence: "low",
    });
    expect(cleaned.ingredients).toHaveLength(2);
    expect(cleaned.ingredients[0]).toMatchObject({ category: null, canonicalName: "garlic" });
    expect(cleaned.ingredients[1].substitutes.map((s) => s.ingredientName)).toEqual(["shallot"]);
  });
});
