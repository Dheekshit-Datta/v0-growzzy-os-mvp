/** Real web research helpers: live search + live page reads. Server-only. */

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

/** Live web search (DuckDuckGo HTML endpoint). Returns [] on failure. */
export async function webSearch(query: string, limit = 6): Promise<SearchResult[]> {
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: { "User-Agent": UA, Accept: "text/html" },
    });
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
        snippet: snippetMatch ? decode(snippetMatch[1]).slice(0, 400) : "",
      });
      if (out.length >= limit) break;
    }
    return out;
  } catch (e) {
    console.error("[growzzy] webSearch failed", (e as Error).message);
    return [];
  }
}

/** Reads a live page and returns readable text (capped). Returns null on failure. */
export async function fetchPageText(url: string, cap = 8000): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" } });
    if (!res.ok) return null;
    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ");
    const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(text)?.[1] ?? "";
    const desc =
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i.exec(text)?.[1] ?? "";
    return decode(`${title}. ${desc}. ${text}`).slice(0, cap);
  } catch (e) {
    console.error("[growzzy] fetchPageText failed", url, (e as Error).message);
    return null;
  }
}

/** Finds a few internal pages worth reading (about / product / pricing / shop). */
export function pickInternalLinks(html: string, origin: string, limit = 3): string[] {
  const found = new Set<string>();
  const re = /href="([^"#?]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && found.size < limit) {
    const href = m[1];
    if (!/about|product|pricing|plans|shop|collections|services|solutions/i.test(href)) continue;
    try {
      const abs = new URL(href, origin);
      if (abs.origin !== new URL(origin).origin) continue;
      found.add(abs.toString());
    } catch {
      /* ignore */
    }
  }
  return [...found];
}

export function normalizeUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return url.toString();
  } catch {
    return null;
  }
}
