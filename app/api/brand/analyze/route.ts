import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/resolve-user";
import { getRequestWorkspaceId } from "@/lib/workspace";
import { invalidateBusinessContext } from "@/lib/business-context";
import { normalizeUrl, fetchPageText, webSearch, pickInternalLinks } from "@/lib/research.server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

const AnalyzeSchema = z.object({
  websiteUrl: z.string().optional(),
  url: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await auth().catch(() => null);
    const body = await request.json().catch(() => ({}));
    const parsed = AnalyzeSchema.parse(body);
    const rawUrl = parsed.websiteUrl || parsed.url || "";

    if (!rawUrl || rawUrl.trim().length < 3) {
      return NextResponse.json({ ok: false, error: { message: "Invalid website URL" } }, { status: 400 });
    }

    const site = normalizeUrl(rawUrl);
    if (!site) {
      return NextResponse.json({ ok: false, error: { message: "Invalid website URL format" } }, { status: 400 });
    }

    // 1. Fetch homepage HTML
    let homepageHtml = "";
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(site, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36", Accept: "text/html" },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) homepageHtml = await res.text();
    } catch (e) {
      console.warn("Could not fetch homepage html directly:", e);
    }

    const homepageText = await fetchPageText(site, 8000);

    // 2. Fetch internal pages (e.g. /pricing, /about, /services, /features)
    const internalLinks = pickInternalLinks(homepageHtml, site, 3);
    const internalTexts = await Promise.all(internalLinks.map((u) => fetchPageText(u, 4000)));

    // 3. Search web for brand reviews & competitors
    let host = "";
    try {
      host = new URL(site).hostname.replace(/^www\./, "");
    } catch {
      host = site;
    }
    const brandGuess = host.split(".")[0] || host;

    const [aboutSearchResults, competitorSearchResults] = await Promise.all([
      webSearch(`${host} what they sell reviews features`, 4),
      webSearch(`${brandGuess} competitors alternatives`, 5),
    ]);

    const sourcesRead = [site, ...internalLinks, ...aboutSearchResults.slice(0, 2).map((r) => r.url)];

    const systemPrompt = `You are a world-class brand strategist, direct-response creative director, and market researcher.
Analyze the comprehensive multi-source live website crawl, internal pages, and live search research.
Extract a deep, structured Brand Profile definition.
Return ONLY valid JSON matching this exact structure:
{
  "brandName": "${brandGuess}",
  "industry": "e.g. Artificial Intelligence / Business Software",
  "businessModel": "e.g. B2B Software/Service or E-Commerce or Direct-To-Consumer",
  "defaultLandingPage": "${site}",
  "whatYouSell": "1-2 concise sentences summarizing the core products, services, and solutions",
  "productDescription": "Comprehensive 2-4 sentence description explaining the technology/value propositions and how it transforms customer operations",
  "positioning": "How the company positions itself as an essential provider vs competitors",
  "idealCustomer": "Target demographic, job titles, and business types looking to buy",
  "differentiators": [
    "Key differentiator 1",
    "Key differentiator 2",
    "Key differentiator 3"
  ],
  "audienceSegments": [
    {
      "segment": "Primary Target Segment",
      "pains": "Core pain points",
      "triggers": "Buying triggers"
    }
  ],
  "competitors": [
    {
      "name": "Market Competitor",
      "url": "https://competitor.com",
      "angle": "Their positioning angle"
    }
  ],
  "keywords": [
    "high intent keyword 1",
    "high intent keyword 2",
    "high intent keyword 3"
  ],
  "creativeAngles": [
    "High-converting hook 1",
    "High-converting hook 2"
  ],
  "toneOfVoice": "Professional"
}`;

    const userPrompt = `
=== HOMEPAGE CONTENT (${site}) ===
${homepageText || "Not available"}

=== INTERNAL PAGES SCANNED ===
${internalTexts.filter(Boolean).join("\n---\n") || "None"}

=== WEB REPUTATION & PRODUCT SEARCH ===
${aboutSearchResults.map((r) => `${r.title}: ${r.snippet}`).join("\n")}

=== COMPETITOR / MARKET SEARCH ===
${competitorSearchResults.map((r) => `${r.title}: ${r.snippet}`).join("\n")}
`;

    let brandMemory: any = null;

    if (process.env.OPENAI_API_KEY) {
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_BRAND_MODEL || "gpt-4o",
        response_format: { type: "json_object" },
        temperature: 0.3,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
      brandMemory = JSON.parse(completion.choices[0]?.message?.content || "{}");
    } else {
      brandMemory = {
        brandName: brandGuess.toUpperCase(),
        industry: "Technology & Software",
        businessModel: "B2B SaaS / Services",
        defaultLandingPage: site,
        whatYouSell: `Digital solutions and services provided by ${brandGuess}.`,
        productDescription: `${brandGuess} delivers modern digital capabilities for scaling businesses.`,
        positioning: `The leading streamlined platform for ${brandGuess} solutions.`,
        idealCustomer: "Growth leaders, business owners, marketing teams",
        differentiators: ["Fast implementation", "AI-powered automation", "End-to-end management"],
        audienceSegments: [{ segment: "Growth Companies", pains: "Manual processes", triggers: "Need for speed" }],
        competitors: [{ name: "Industry Alternative", url: "https://example.com", angle: "Legacy tool" }],
        keywords: [`${brandGuess} software`, `${brandGuess} platform`, "ai automation"],
        creativeAngles: ["Scale faster with intelligent workflows", "Built for high performance"],
        toneOfVoice: "Professional",
      };
    }

    // Try persisting to Prisma if user has session
    if (session?.user?.id) {
      try {
        const userId = await resolveUserId(session.user.id);
        const workspaceId = await getRequestWorkspaceId(userId, request as any);
        if (workspaceId) {
          await prisma.workspace.update({
            where: { id: workspaceId },
            data: {
              name: brandMemory.brandName || undefined,
              websiteUrl: site,
              productDescription: brandMemory.productDescription || undefined,
              industry: brandMemory.industry || undefined,
              toneOfVoice: brandMemory.toneOfVoice || undefined,
              defaultLandingPageUrl: brandMemory.defaultLandingPage || site,
            },
          });
          invalidateBusinessContext(workspaceId);
        }
      } catch (dbErr) {
        console.warn("Could not save to workspace in DB (fallback to local state):", dbErr);
      }
    }

    return NextResponse.json({
      ok: true,
      site,
      profile: {
        businessName: brandMemory.brandName || brandGuess,
        industry: brandMemory.industry || "Technology",
        businessModel: brandMemory.businessModel || "B2B",
        whatTheySell: brandMemory.whatYouSell || brandMemory.whatTheySell || "",
        productDescription: brandMemory.productDescription || "",
        positioning: brandMemory.positioning || "",
        differentiators: brandMemory.differentiators || [],
        audience: brandMemory.idealCustomer || brandMemory.audience || "",
        segments: (brandMemory.audienceSegments || []).map((s: any) => ({
          segment: s.segment || s.title || "Target Audience",
          pains: s.pains || s.painPoints || "",
          triggers: s.triggers || "",
        })),
        competitors: (brandMemory.competitors || []).map((c: any) => ({
          name: c.name || "Competitor",
          url: c.url || site,
          angle: c.angle || c.description || "",
        })),
        keywords: brandMemory.keywords || brandMemory.highIntentKeywords || [],
        creativeAngles: brandMemory.creativeAngles || [],
        tone: brandMemory.toneOfVoice || "professional",
        sources: sourcesRead,
      },
      data: {
        brandMemory,
      },
    });
  } catch (error: any) {
    console.error("Brand deep analysis error:", error);
    return NextResponse.json(
      { ok: false, error: { message: error?.message || "Failed to analyze website brand" } },
      { status: 500 }
    );
  }
}
