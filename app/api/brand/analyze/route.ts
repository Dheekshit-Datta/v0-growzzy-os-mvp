import { NextResponse } from "next/server"
import OpenAI from "openai"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId } from "@/lib/workspace"
import { invalidateBusinessContext } from "@/lib/business-context"
import { normalizeUrl, fetchPageText, webSearch, pickInternalLinks } from "@/lib/deep-research"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" })

const AnalyzeSchema = z.object({
  websiteUrl: z.string().min(3, "Invalid website URL"),
})

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: { message: "Unauthorized" } }, { status: 401 })
    }
    const userId = await resolveUserId(session.user.id)
    const workspaceId = await getRequestWorkspaceId(userId, request as any)
    const body = await request.json()
    const { websiteUrl: rawUrl } = AnalyzeSchema.parse(body)

    const site = normalizeUrl(rawUrl)
    if (!site) {
      return NextResponse.json({ ok: false, error: { message: "Invalid website URL" } }, { status: 400 })
    }

    // 1. Fetch homepage HTML
    let homepageHtml = ""
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)
      const res = await fetch(site, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; GrowzzyOS/1.0)", Accept: "text/html" },
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      if (res.ok) homepageHtml = await res.text()
    } catch (e) {
      console.warn("Could not fetch homepage html directly:", e)
    }

    const homepageText = await fetchPageText(site, 8000)

    // 2. Fetch internal pages (e.g. /pricing, /about, /services, /features)
    const internalLinks = pickInternalLinks(homepageHtml, site, 3)
    const internalTexts = await Promise.all(internalLinks.map((u) => fetchPageText(u, 4000)))

    // 3. Search web for live brand reviews & competitors
    let host = ""
    try {
      host = new URL(site).hostname.replace(/^www\./, "")
    } catch {
      host = site
    }
    const brandGuess = host.split(".")[0] || host

    const [aboutSearchResults, competitorSearchResults] = await Promise.all([
      webSearch(`${host} what they sell reviews features`, 4),
      webSearch(`${brandGuess} competitors alternatives`, 5),
    ])

    const sourcesRead = [site, ...internalLinks, ...aboutSearchResults.slice(0, 2).map((r) => r.url)]

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ ok: false, error: { message: "OPENAI_API_KEY not configured" } }, { status: 503 })
    }

    const systemPrompt = `You are a world-class brand strategist, direct-response creative director, and market researcher.
Analyze the comprehensive multi-source live website crawl, internal pages, and live search research.
Extract a deep, structured Brand Profile definition.
Return ONLY valid JSON matching this exact structure:
{
  "brandName": "extracted brand name or company name",
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
    "Key differentiator 3",
    "Key differentiator 4"
  ],
  "audienceSegments": [
    {
      "title": "Operations-Heavy Businesses",
      "painPoints": "Inefficient manual processes, high operational costs, bottlenecks in workflows, desire for scalability without proportional headcount increase."
    },
    {
      "title": "Forward-Thinking Enterprises",
      "painPoints": "Struggling to integrate advanced AI into existing systems, lack of internal expertise, desire to leverage AI for competitive differentiation."
    },
    {
      "title": "Businesses with Complex Workflows",
      "painPoints": "Difficulty coordinating multiple interdependent processes, challenges in automating nuanced decision-making, need for intelligent automation beyond simple RPA."
    }
  ],
  "competitors": [
    {
      "name": "Market Competitor / Alternative",
      "description": "How they compete and why our brand has the superior positioning/angle"
    }
  ],
  "highIntentKeywords": [
    "high intent keyword 1",
    "high intent keyword 2",
    "high intent keyword 3",
    "high intent keyword 4",
    "high intent keyword 5",
    "high intent keyword 6"
  ],
  "creativeAngles": [
    "Compelling high-converting direct response hook 1",
    "Compelling high-converting direct response hook 2",
    "Compelling high-converting direct response hook 3"
  ],
  "toneOfVoice": "Professional",
  "colorTheme": "Growzzy",
  "sourcesRead": ${JSON.stringify(sourcesRead.slice(0, 5))}
}`

    const userPrompt = `
=== HOMEPAGE CONTENT (${site}) ===
${homepageText || "Not available"}

=== INTERNAL PAGES SCANNED ===
${internalTexts.filter(Boolean).join("\n---\n") || "None"}

=== WEB REPUTATION & PRODUCT SEARCH ===
${aboutSearchResults.map((r) => `${r.title}: ${r.snippet}`).join("\n")}

=== COMPETITOR / MARKET SEARCH ===
${competitorSearchResults.map((r) => `${r.title}: ${r.snippet}`).join("\n")}
`

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_BRAND_MODEL || "gpt-4o",
      response_format: { type: "json_object" },
      temperature: 0.4,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    })

    const brandMemory = JSON.parse(completion.choices[0]?.message?.content || "{}")

    // Update workspace record with extracted parameters
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
    })

    invalidateBusinessContext(workspaceId)

    return NextResponse.json({
      ok: true,
      data: {
        brandMemory,
        workspaceId,
      },
    })
  } catch (error: any) {
    console.error("Brand deep analysis error:", error)
    return NextResponse.json(
      { ok: false, error: { message: error?.message || "Failed to analyze website brand" } },
      { status: 500 }
    )
  }
}
