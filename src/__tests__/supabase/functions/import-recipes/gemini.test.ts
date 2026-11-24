// @vitest-environment node
import { callGeminiWithBackoff, extractGeminiText } from "../../../../../supabase/functions/import-recipes/gemini.ts";

describe("extractGeminiText", () => {
  it("joins the parts of the first answer", () => {
    expect(
      extractGeminiText({ candidates: [{ content: { parts: [{ text: '{"recipes":' }, { text: "[]}" }] } }] })
    ).toBe('{"recipes":[]}');
  });

  it.each([null, "text", {}, { candidates: [] }, { candidates: [{ content: { parts: "x" } }] }])(
    "returns nothing for an answer without text (%j)",
    (json) => {
      expect(extractGeminiText(json)).toBe("");
    }
  );
});

describe("callGeminiWithBackoff", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("returns a successful answer straight away", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));

    const response = await callGeminiWithBackoff("prompt", "key", {});

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // Retries stop at the time budget, so the function answers within its own
  // time limit (the person sees the rate-limit message).
  it("stops retrying once the time budget would run out", async () => {
    fetchMock.mockResolvedValue(new Response("busy", { status: 429, headers: { "retry-after": "30" } }));

    const response = await callGeminiWithBackoff("prompt", "key", {}, Date.now() + 1_000);

    expect(response.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("doesn't retry an error that won't change", async () => {
    fetchMock.mockResolvedValue(new Response("bad request", { status: 400 }));

    expect((await callGeminiWithBackoff("prompt", "key", {})).status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
