import {
  corsHeaders,
  DEFAULT_ALLOWED_ORIGINS,
  parseAllowedOrigins,
} from "../../../../../supabase/functions/import-recipes/cors.ts";

describe("import function CORS", () => {
  it("allows the production site and local dev by default", () => {
    expect(parseAllowedOrigins(undefined)).toEqual([
      "https://www.allbluemeals.com",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ]);
    expect(parseAllowedOrigins("  ")).toBe(DEFAULT_ALLOWED_ORIGINS);
  });

  it("uses the ALLOWED_ORIGINS secret instead when set", () => {
    expect(parseAllowedOrigins(" https://a.example/ , https://b.example ")).toEqual([
      "https://a.example",
      "https://b.example",
    ]);
  });

  it("echoes an allowed origin, and always varies by origin", () => {
    const headers = corsHeaders("https://www.allbluemeals.com", DEFAULT_ALLOWED_ORIGINS);
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://www.allbluemeals.com");
    expect(headers.Vary).toBe("Origin");
  });

  it.each([
    ["another site", "https://evil.example"],
    ["the bare domain (it redirects to www)", "https://allbluemeals.com"],
    ["a different port", "http://localhost:3000"],
    ["no origin", null],
  ])("doesn't allow %s", (_label, origin) => {
    const headers = corsHeaders(origin, DEFAULT_ALLOWED_ORIGINS);
    expect(headers).not.toHaveProperty("Access-Control-Allow-Origin");
    expect(headers.Vary).toBe("Origin");
  });
});
