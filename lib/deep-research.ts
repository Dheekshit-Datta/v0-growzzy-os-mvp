/**
 * Live Web Research & Scraping Helpers
 * Used for deep brand analysis & conversational agent research.
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

function decode(s: string): string {
  return s
    .replace(/<[^>]*>/g, "")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalize URL */
export function normalizeUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const withProtocol = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withProtocol);
    if (!u.hostname.includes(".")) return null;
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

/** Live web search using DuckDuckGo endpoint */
export async function webSearch(query: string, limit = 6): Promise<SearchResult[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const html = await res.text();
    const out: SearchResult[] = [];
    const blocks = html.split('class="result__a"').slice(1);
    for (const block of blocks) {
      const hrefMatch = /href="([^"]+)"/.exec(block);
      const titleMatch = />([^<]+)</.exec(block);
      const snippetMatch = /result__snippet"[^>]*>([\s\S]*?)<\/a>/.exec(block);
      if (!hrefMatch || !titleMatch) continue;
      let url = decode(hrefMatch[1]);
      const uddg = /uddg=([^&]+)/.exec(url);
      if (uddg) url = decodeURIComponent(uddg[1]);
      if (!url.startsWith("http")) continue;
      out.push({
        title: decode(titleMatch[1]),
        url,
        snippet: snippetMatch ? decode(snippetMatch[1]) : "",
      });
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}

/** Fetches readable text from a URL */
export async function fetchPageText(url: string, maxLength = 8000): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,text/plain" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return "";
    const html = await res.text();
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxLength);
  } catch {
    return "";
  }
}

/** Picks internal links from homepage */
export function pickInternalLinks(html: string, baseUrl: string, limit = 3): string[] {
  try {
    const baseHost = new URL(baseUrl).hostname;
    const matches = html.matchAll(/href="([^"#?]+)"/g);
    const links = new Set<string>();
    for (const m of matches) {
      const href = m[1];
      if (
        !href ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.endsWith(".png") ||
        href.endsWith(".jpg") ||
        href.endsWith(".pdf")
      ) {
        continue;
      }
      try {
        const full = new URL(href, baseUrl);
        if (full.hostname === baseHost && full.pathname !== "/" && full.pathname !== "") {
          links.add(full.toString());
          if (links.size >= limit) break;
        }
      } catch {}
    }
    return Array.from(links);
  } catch {
    return [];
  }
}
