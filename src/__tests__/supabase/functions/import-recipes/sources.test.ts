// @vitest-environment node
// Node's fetch Response, with real body streams.
import {
  fetchSource,
  MAX_REDIRECTS,
  readTextCapped,
} from "../../../../../supabase/functions/import-recipes/sources.ts";

const page = (html: string, init: ResponseInit = {}) => new Response(html, { status: 200, ...init });
const redirect = (location: string) => new Response(null, { status: 302, headers: { location } });

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe("readTextCapped", () => {
  it("reads a small page whole", async () => {
    expect(await readTextCapped(page("<h1>Soup</h1>"), 1_000)).toBe("<h1>Soup</h1>");
  });

  it("stops reading at the byte limit", async () => {
    expect(await readTextCapped(page("a".repeat(5_000)), 100)).toHaveLength(100);
  });
});

describe("fetchSource", () => {
  it("reads a public recipe page as text", async () => {
    fetchMock.mockResolvedValue(page("<title>Garlic Soup</title><p>Simmer the garlic.</p>"));

    const source = await fetchSource("https://example.com/soup");

    expect(source).toMatchObject({ title: "Garlic Soup", warning: null });
    expect(source.text).toContain("Simmer the garlic.");
    expect(fetchMock).toHaveBeenCalledWith("https://example.com/soup", expect.objectContaining({ redirect: "manual" }));
  });

  it("never fetches a private address", async () => {
    const source = await fetchSource("http://169.254.169.254/latest/meta-data/");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(source.warning).toBe(
      "Skipped http://169.254.169.254/latest/meta-data/: only public web pages can be imported."
    );
  });

  // A public page could redirect to an internal address; each hop is checked.
  it("refuses a redirect to a private address", async () => {
    fetchMock.mockResolvedValueOnce(redirect("http://127.0.0.1/admin"));

    const source = await fetchSource("https://example.com/r");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(source.warning).toBe("Skipped https://example.com/r: only public web pages can be imported.");
  });

  it("follows a redirect to another public page", async () => {
    fetchMock
      .mockResolvedValueOnce(redirect("/recipes/soup"))
      .mockResolvedValueOnce(page("<p>Garlic soup</p>"));

    const source = await fetchSource("https://example.com/r");

    expect(fetchMock).toHaveBeenLastCalledWith("https://example.com/recipes/soup", expect.anything());
    expect(source.text).toContain("Garlic soup");
  });

  it("gives up after too many redirects", async () => {
    fetchMock.mockImplementation(async () => redirect("https://example.com/again"));

    const source = await fetchSource("https://example.com/r");

    expect(fetchMock).toHaveBeenCalledTimes(MAX_REDIRECTS + 1);
    expect(source.warning).toBe("Could not read https://example.com/r (too many redirects).");
  });

  it("reports a page that doesn't load", async () => {
    fetchMock.mockResolvedValue(page("Not found", { status: 404 }));

    expect((await fetchSource("https://example.com/gone")).warning).toBe(
      "Could not read https://example.com/gone (404)."
    );
  });
});
