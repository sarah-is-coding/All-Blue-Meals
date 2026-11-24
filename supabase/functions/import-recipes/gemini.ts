// Calling Gemini with the recipe response schema, retrying rate limits and
// server errors with backoff.

const GEMINI_MODEL = "gemini-2.5-flash-lite";
const GEMINI_MAX_ATTEMPTS = 5;

/** The text of Gemini's first answer, or "" when there isn't one. */
export const extractGeminiText = (json: unknown): string => {
  const candidates = isRecord(json) ? json.candidates : undefined;
  const first = Array.isArray(candidates) ? candidates[0] : undefined;
  const content = isRecord(first) ? first.content : undefined;
  const parts = isRecord(content) ? content.parts : undefined;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => (isRecord(part) && typeof part.text === "string" ? part.text : ""))
    .join("")
    .trim();
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const parseGeminiJson = (text: string): unknown => {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  return JSON.parse(fenced ?? trimmed);
};

const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const getRetryDelay = (attempt: number, retryAfterHeader: string | null): number => {
  const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : Number.NaN;
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Math.min(retryAfterSeconds * 1_000, 30_000);
  }

  const baseDelay = Math.min(2 ** attempt * 1_000, 10_000);
  const jitter = Math.floor(Math.random() * 350);
  return baseDelay + jitter;
};

const shouldRetryGeminiRequest = (status: number): boolean =>
  status === 429 || status === 500 || status === 502 || status === 503 || status === 504;

/** How long retries may take in total, so the function answers well within
 *  its own time limit (the person gets the rate-limit message instead). */
export const GEMINI_RETRY_BUDGET_MS = 60_000;

export const callGeminiWithBackoff = async (
  prompt: string,
  apiKey: string,
  responseSchema: unknown,
  /** Stop retrying once waiting again would pass this time (ms since epoch). */
  deadline: number = Date.now() + GEMINI_RETRY_BUDGET_MS
): Promise<Response> => {
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt < GEMINI_MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 32_000,
            responseMimeType: "application/json",
            responseSchema,
          },
        }),
      }
    );

    if (!shouldRetryGeminiRequest(response.status) || attempt === GEMINI_MAX_ATTEMPTS - 1) {
      return response;
    }

    const delay = getRetryDelay(attempt, response.headers.get("retry-after"));
    if (Date.now() + delay > deadline) return response;

    lastResponse = response;
    await response.body?.cancel();
    await sleep(delay);
  }

  if (!lastResponse) {
    throw new Error("Gemini request failed before a response was returned.");
  }

  return lastResponse;
};
