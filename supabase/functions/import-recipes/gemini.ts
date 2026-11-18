// Calling Gemini with the recipe response schema, retrying rate limits and
// server errors with backoff.

const GEMINI_MODEL = "gemini-2.5-flash-lite";
const GEMINI_MAX_ATTEMPTS = 5;

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

export const callGeminiWithBackoff = async (
  prompt: string,
  apiKey: string,
  responseSchema: unknown
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

    lastResponse = response;
    await response.body?.cancel();
    await sleep(getRetryDelay(attempt, response.headers.get("retry-after")));
  }

  if (!lastResponse) {
    throw new Error("Gemini request failed before a response was returned.");
  }

  return lastResponse;
};
