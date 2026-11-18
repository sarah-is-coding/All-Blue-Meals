// import-recipes: turns pasted notes and links (mode "import") or a request
// (mode "generate") into recipe drafts with Gemini. Modules:
// - sources.ts: fetching and stripping recipe pages
// - prompt.ts: the prompts, including the ingredient naming rules
// - schema.ts: the JSON shape Gemini must return
// - gemini.ts: the API call with retries, and parsing its JSON

import { callGeminiWithBackoff, parseGeminiJson } from "./gemini.ts";
import { buildGeneratePrompt, buildImportPrompt } from "./prompt.ts";
import { extractUrls, fetchSource } from "./sources.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RequestMode = "import" | "generate";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Use POST to import recipes." }, 405);
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return jsonResponse({ error: "Missing GEMINI_API_KEY for recipe import." }, 500);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return jsonResponse({ error: "You must be signed in to import recipes." }, 401);
  }

  const body = await request.json().catch(() => null) as {
    mode?: RequestMode;
    text?: string;
  } | null;
  const mode = body?.mode === "generate" ? "generate" : "import";
  const text = body?.text?.trim() ?? "";
  if (!text) {
    return jsonResponse(
      {
        error:
          mode === "generate"
            ? "Describe the recipe or recipes you want to generate."
            : "Paste recipe notes, links, or both.",
      },
      400
    );
  }

  const urls = mode === "import" ? extractUrls(text) : [];
  const sources = mode === "import" ? await Promise.all(urls.map(fetchSource)) : [];
  const sourceWarnings = sources
    .map((source) => source.warning)
    .filter((warning): warning is string => Boolean(warning));

  const prompt =
    mode === "generate" ? buildGeneratePrompt(text) : buildImportPrompt(text, sources);
  const geminiResponse = await callGeminiWithBackoff(prompt, apiKey);

  if (!geminiResponse.ok) {
    const errorText = await geminiResponse.text();
    const friendlyRateLimitMessage =
      geminiResponse.status === 429
        ? "Gemini is rate limited right now. Wait a minute and try the import again."
        : null;
    return jsonResponse(
      {
        error:
          friendlyRateLimitMessage ??
          `Gemini recipe extraction failed: ${errorText.slice(0, 400)}`,
      },
      502
    );
  }

  const geminiJson = await geminiResponse.json();
  const responseText = geminiJson.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text ?? "")
    .join("")
    .trim();

  if (!responseText) {
    return jsonResponse({ error: "Gemini returned an empty recipe import." }, 502);
  }

  try {
    const parsed = parseGeminiJson(responseText) as {
      recipes?: unknown[];
      warnings?: string[];
    };
    return jsonResponse({
      recipes: parsed.recipes ?? [],
      warnings: [...sourceWarnings, ...(parsed.warnings ?? [])],
    });
  } catch {
    return jsonResponse({ error: "Gemini returned invalid JSON." }, 502);
  }
});
