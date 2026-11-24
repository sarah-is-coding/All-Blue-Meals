// Fetching recipe pages for import: find URLs in the user's text, download
// each page, and keep the readable text plus any schema.org Recipe data.
// Remote HTML is never trusted: it's stripped to text before the model sees it.
// Only public web pages are fetched (urlSafety.ts), redirects included, and at
// most MAX_PAGE_BYTES of each page is read.
//
// No Deno globals here, so the app's tests (Vitest) can import this module.

import { isPublicHttpUrl } from "./urlSafety.ts";

export const MAX_URLS = 24;
export const MAX_SOURCE_CHARS = 18_000;
/** How much of a page is read; recipe pages are far smaller. */
export const MAX_PAGE_BYTES = 800_000;
/** Redirects followed per URL (each checked like the URL itself). */
export const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 8_000;

export type SourceContent = {
  url: string;
  title: string;
  text: string;
  warning: string | null;
};

export const extractUrls = (text: string): string[] => {
  const matches = text.match(/https?:\/\/[^\s<>"')]+/gi) ?? [];
  return Array.from(new Set(matches.map((url) => url.replace(/[.,;!?]+$/, "")))).slice(
    0,
    MAX_URLS
  );
};

const decodeHtmlEntities = (value: string): string =>
  value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&rsquo;/gi, "'")
    .replace(/&lsquo;/gi, "'")
    .replace(/&rdquo;/gi, '"')
    .replace(/&ldquo;/gi, '"')
    .replace(/&ndash;/gi, "-")
    .replace(/&mdash;/gi, "-")
    .replace(/&deg;/gi, " degrees ");

const stripHtml = (html: string): string =>
  decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
      .replace(/<header[\s\S]*?<\/header>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );

const extractTitle = (html: string): string => {
  const ogTitle = html.match(
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
  )?.[1];
  const title = ogTitle ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  return decodeHtmlEntities(title.replace(/\s+/g, " ").trim());
};

const extractJsonLdRecipes = (html: string): string => {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1].trim())
    .filter((block) => /"@type"\s*:\s*"Recipe"|"@type"\s*:\s*\[[^\]]*"Recipe"/i.test(block));

  return blocks.join("\n").slice(0, MAX_SOURCE_CHARS);
};

/** Reads at most `maxBytes` of a response body as text, then stops the
 *  download, so a huge page can't use up the function's memory. */
export async function readTextCapped(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";
  try {
    while (received < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value.subarray(0, maxBytes - received);
      received += chunk.byteLength;
      text += decoder.decode(chunk, { stream: true });
    }
    text += decoder.decode();
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return text;
}

type PageFetch =
  | { kind: "ok"; response: Response }
  | { kind: "blocked" }
  | { kind: "too-many-redirects" };

/** Fetches a public page, following redirects by hand so every hop gets the
 *  same public-address check as the pasted URL. */
async function fetchPublicPage(url: string, signal: AbortSignal): Promise<PageFetch> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (!isPublicHttpUrl(current)) return { kind: "blocked" };
    const response = await fetch(current, {
      signal,
      redirect: "manual",
      headers: {
        "User-Agent": "All Blue Meals recipe importer",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    const location = response.status >= 300 && response.status < 400 ? response.headers.get("location") : null;
    if (!location) return { kind: "ok", response };
    await response.body?.cancel();
    current = new URL(location, current).toString();
  }
  return { kind: "too-many-redirects" };
}

export const fetchSource = async (url: string): Promise<SourceContent> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const unread = (warning: string): SourceContent => ({ url, title: "", text: "", warning });

  try {
    const page = await fetchPublicPage(url, controller.signal);
    if (page.kind === "blocked") {
      return unread(`Skipped ${url}: only public web pages can be imported.`);
    }
    if (page.kind === "too-many-redirects") {
      return unread(`Could not read ${url} (too many redirects).`);
    }
    const { response } = page;

    if (!response.ok) {
      await response.body?.cancel();
      return unread(`Could not read ${url} (${response.status}).`);
    }

    const html = await readTextCapped(response, MAX_PAGE_BYTES);
    const jsonLd = extractJsonLdRecipes(html);
    const pageText = stripHtml(html).slice(0, MAX_SOURCE_CHARS);
    const text = [jsonLd ? `Recipe structured data:\n${jsonLd}` : "", pageText]
      .filter(Boolean)
      .join("\n\n");

    return {
      url,
      title: extractTitle(html),
      text: text.slice(0, MAX_SOURCE_CHARS),
      warning: text ? null : `No readable recipe text found at ${url}.`,
    };
  } catch {
    return unread(`Could not read ${url}.`);
  } finally {
    clearTimeout(timeout);
  }
};
