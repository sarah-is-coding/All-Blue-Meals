// import-recipes: turns pasted notes and links (mode "import") or a request
// (mode "generate") into recipe drafts with Gemini. Modules:
// - validate.ts: checking the request, the categories, and Gemini's output
// - urlSafety.ts: which pasted URLs may be fetched (public pages only)
// - sources.ts: fetching and stripping recipe pages
// - cors.ts: which sites may call this function
// - prompt.ts: the prompts, including the ingredient naming rules
// - schema.ts: the JSON shape Gemini must return
// - categories.ts: the ingredient categories, read from the database
// - gemini.ts: the API call with retries, and reading its answer
//
// Errors returned to the app are fixed, friendly messages. Details go to the
// function's logs, without the user's text or recipes.

import { type Category, loadCategories } from "./categories.ts";
import { corsHeaders, parseAllowedOrigins } from "./cors.ts";
import { callGeminiWithBackoff, extractGeminiText, parseGeminiJson } from "./gemini.ts";
import { buildGeneratePrompt, buildImportPrompt } from "./prompt.ts";
import { buildRecipeSchema } from "./schema.ts";
import { extractUrls, fetchSource } from "./sources.ts";
import { parseImportRequest, sanitizeImportResult } from "./validate.ts";

const allowedOrigins = parseAllowedOrigins(Deno.env.get("ALLOWED_ORIGINS"));

const UNAVAILABLE = "Recipe import isn't available right now. Try again later.";
const RATE_LIMITED = "Gemini is rate limited right now. Wait a minute and try the import again.";
const UNREADABLE = "The recipe import didn't come back in a usable form. Try again.";

Deno.serve(async (request) => {
  const cors = corsHeaders(request.headers.get("Origin"), allowedOrigins);
  const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Use POST to import recipes." }, 405);
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    console.error("import-recipes: GEMINI_API_KEY is not set");
    return jsonResponse({ error: UNAVAILABLE }, 500);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return jsonResponse({ error: "You must be signed in to import recipes." }, 401);
  }

  const parsedRequest = parseImportRequest(await request.json().catch(() => null));
  if ("error" in parsedRequest) {
    return jsonResponse({ error: parsedRequest.error }, 400);
  }
  const { mode, text } = parsedRequest;

  let categories: Category[];
  try {
    categories = await loadCategories(authorization);
  } catch (error) {
    console.error("import-recipes: loading categories failed:", error instanceof Error ? error.message : error);
    return jsonResponse({ error: "Couldn't load ingredient categories. Try again in a moment." }, 503);
  }
  const categoryCodes = categories.map((category) => category.id);

  const urls = mode === "import" ? extractUrls(text) : [];
  const sources = mode === "import" ? await Promise.all(urls.map(fetchSource)) : [];
  const sourceWarnings = sources
    .map((source) => source.warning)
    .filter((warning): warning is string => Boolean(warning));

  const prompt =
    mode === "generate" ? buildGeneratePrompt(text, categories) : buildImportPrompt(text, sources, categories);
  const geminiResponse = await callGeminiWithBackoff(prompt, apiKey, buildRecipeSchema(categoryCodes));

  if (!geminiResponse.ok) {
    // Log only Gemini's status name (e.g. RESOURCE_EXHAUSTED): its error
    // message can echo parts of the request, which may include user content.
    const body: unknown = await geminiResponse.json().catch(() => null);
    const errorBody = typeof body === "object" && body !== null && "error" in body ? body.error : null;
    const statusName =
      typeof errorBody === "object" && errorBody !== null && "status" in errorBody && typeof errorBody.status === "string"
        ? errorBody.status
        : "unknown";
    console.error(`import-recipes: Gemini returned ${geminiResponse.status} (${statusName})`);
    return jsonResponse({ error: geminiResponse.status === 429 ? RATE_LIMITED : UNAVAILABLE }, 502);
  }

  const responseText = extractGeminiText(await geminiResponse.json().catch(() => null));
  if (!responseText) {
    console.error("import-recipes: Gemini returned no text");
    return jsonResponse({ error: UNREADABLE }, 502);
  }

  let parsed: unknown;
  try {
    parsed = parseGeminiJson(responseText);
  } catch {
    console.error("import-recipes: Gemini returned invalid JSON");
    return jsonResponse({ error: UNREADABLE }, 502);
  }

  const result = sanitizeImportResult(parsed, categoryCodes);
  return jsonResponse({
    recipes: result.recipes,
    warnings: [...sourceWarnings, ...result.warnings],
  });
});
