// Fetching recipe pages for import: find URLs in the user's text, download
// each page, and keep the readable text plus any schema.org Recipe data.
// Remote HTML is never trusted: it's stripped to text before the model sees it.

export const MAX_URLS = 24;
export const MAX_SOURCE_CHARS = 18_000;

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

export const fetchSource = async (url: string): Promise<SourceContent> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "All Blue Meals recipe importer",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      return {
        url,
        title: "",
        text: "",
        warning: `Could not read ${url} (${response.status}).`,
      };
    }

    const html = (await response.text()).slice(0, 800_000);
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
    return {
      url,
      title: "",
      text: "",
      warning: `Could not read ${url}.`,
    };
  } finally {
    clearTimeout(timeout);
  }
};
