/** Deep website + competitor analysis. Server-only. Shared by My Brand and the chat agent. */
import OpenAI from "openai";

export interface AnalyzedBrand {
  businessName: string;
  industry: string;
  businessModel: string;
  whatTheySell: string;
  productDescription: string;
  positioning: string;
  differentiators: string[];
  audience: string;
  segments: { segment: string; pains: string; triggers: string }[];
  competitors: { name: string; url: string; angle: string }[];
  keywords: string[];
  creativeAngles: string[];
  tone: string;
  sources: string[];
}

export async function analyzeSite(
  apiKey: string,
  url: string,
): Promise<{ site: string; profile: AnalyzedBrand }> {
  const { normalizeUrl, fetchPageText, webSearch, pickInternalLinks } = await import(
    "@/lib/research.server"
  );

  const site = normalizeUrl(url);
  if (!site) throw new Error("That doesn't look like a valid website URL.");

  const homepageHtml = await fetch(site, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
  })
    .then((r) => (r.ok ? r.text() : ""))
    .catch(() => "");
  if (!homepageHtml) throw new Error(`Couldn't reach ${site}. Check the URL and try again.`);

  const homepage = await fetchPageText(site, 10000);
  const inner = pickInternalLinks(homepageHtml, site, 3);
  const innerTexts = await Promise.all(inner.map((u) => fetchPageText(u, 5000)));

  const host = new URL(site).hostname.replace(/^www\./, "");
  const brandGuess = host.split(".")[0];
  const [aboutSearch, competitorSearch] = await Promise.all([
    webSearch(`${host} what they sell reviews`, 5),
    webSearch(`${brandGuess} competitors alternatives`, 6),
  ]);
  const competitorPages = await Promise.all(
    competitorSearch.slice(0, 2).map((r) => fetchPageText(r.url, 3500)),
  );

  const sources = [
    site,
    ...inner,
    ...aboutSearch.map((r) => r.url),
    ...competitorSearch.map((r) => r.url),
  ].slice(0, 14);

  const corpus = [
    `HOMEPAGE (${site}):\n${homepage ?? ""}`,
    ...innerTexts.map((t, i) => (t ? `PAGE (${inner[i]}):\n${t}` : "")),
    `WEB SEARCH — brand:\n${aboutSearch.map((r) => `- ${r.title} (${r.url}): ${r.snippet}`).join("\n")}`,
    `WEB SEARCH — competitors:\n${competitorSearch.map((r) => `- ${r.title} (${r.url}): ${r.snippet}`).join("\n")}`,
    ...competitorPages.map((t, i) =>
      t ? `COMPETITOR PAGE (${competitorSearch[i]?.url}):\n${t}` : "",
    ),
  ]
    .filter(Boolean)
    .join("\n\n");

  const openai = new OpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY || "" });
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_CHAT_MODEL || "gpt-4o",
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a senior brand + performance-marketing analyst. You are given REAL scraped page content and REAL web search results. Analyse them deeply and return ONLY a JSON object with exactly these keys: businessName, industry, businessModel, whatTheySell, productDescription, positioning, differentiators (array of strings), audience, segments (array of {segment, pains, triggers}), competitors (array of {name, url, angle}), keywords (array of high-intent search keywords), creativeAngles (array of strings), tone (one of friendly, professional, playful, premium). Ground every field in the supplied material; never invent a company. Keep 3-5 differentiators, 3 segments, 3-5 competitors, 10-14 keywords, 4-6 creative angles.",
      },
      {
        role: "user",
        content: `Website: ${site}\n\n${corpus.slice(0, 60000)}`,
      },
    ],
  });

  const rawJson = completion.choices[0]?.message?.content || "{}";
  let parsed: Partial<AnalyzedBrand>;
  try {
    parsed = JSON.parse(rawJson) as Partial<AnalyzedBrand>;
  } catch {
    throw new Error("Analysis came back unreadable — try again.");
  }

  const profile: AnalyzedBrand = {
    businessName: parsed.businessName || brandGuess,
    industry: parsed.industry || "",
    businessModel: parsed.businessModel || "",
    whatTheySell: parsed.whatTheySell || "",
    productDescription: parsed.productDescription || "",
    positioning: parsed.positioning || "",
    differentiators: parsed.differentiators?.slice(0, 6) ?? [],
    audience: parsed.audience || "",
    segments: parsed.segments?.slice(0, 4) ?? [],
    competitors: parsed.competitors?.slice(0, 6) ?? [],
    keywords: parsed.keywords?.slice(0, 16) ?? [],
    creativeAngles: parsed.creativeAngles?.slice(0, 8) ?? [],
    tone: parsed.tone || "professional",
    sources,
  };
  return { site, profile };
}
