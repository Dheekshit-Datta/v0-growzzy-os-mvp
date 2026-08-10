import { NextResponse } from "next/server"
import OpenAI from "openai"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId } from "@/lib/workspace"
import { invalidateBusinessContext } from "@/lib/business-context"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" })

const AnalyzeSchema = z.object({
  websiteUrl: z.string().url("Invalid website URL"),
})

function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: { message: "Unauthorized" } }, { status: 401 })
    }
    const userId = await resolveUserId(session.user.id)
    const workspaceId = await getRequestWorkspaceId(userId, request as any)
    const body = await request.json()
    const { websiteUrl } = AnalyzeSchema.parse(body)

    let html = ""
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)
      const res = await fetch(websiteUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; GrowzzyOS/1.0)" },
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      if (res.ok) html = await res.text()
    } catch (e) {
      console.warn("Could not fetch website html directly:", e)
    }

    const pageText = extractTextFromHtml(html).slice(0, 4000)

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ ok: false, error: { message: "OPENAI_API_KEY not configured" } }, { status: 503 })
    }

    const systemPrompt = `You are a world-class brand strategist and creative director.
Analyze the provided website URL and page text. Extract a comprehensive, structured Brand Memory definition.
Return ONLY valid JSON matching this structure:
{
  "brandName": "extracted brand or company name",
  "tagline": "primary brand tagline or value statement",
  "archetype": "The Creator | The Innovator | The Authority | The Rebel | The Caregiver | The Explorer",
  "brandStory": "1-2 sentence core positioning narrative",
  "toneOfVoice": "Primary tone (e.g. Professional & Confident)",
  "voiceProfile": [
    { "attribute": "Confident", "intensity": "High" },
    { "attribute": "Technical", "intensity": "Moderate" },
    { "attribute": "Authoritative", "intensity": "High" }
  ],
  "colorPalette": {
    "primaryHex": "#0B0B0B",
    "secondaryHex": "#1F57F5",
    "accentHex": "#10B981",
    "backgroundHex": "#F9FAFB",
    "description": "Dark minimalist high-contrast theme"
  },
  "typography": {
    "headingFont": "Inter, sans-serif",
    "bodyFont": "Roboto, sans-serif"
  },
  "productDescription": "Comprehensive summary of product/service capabilities, target buyer, and key value propositions."
}`

    const userPrompt = `Website URL: ${websiteUrl}\nExtracted Page Text:\n${pageText || "Not available"}`

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_BRAND_MODEL || "gpt-4o",
      response_format: { type: "json_object" },
      temperature: 0.5,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    })

    const brandMemory = JSON.parse(completion.choices[0]?.message?.content || "{}")

    // Update workspace with extracted brand parameters
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        name: brandMemory.brandName || undefined,
        websiteUrl: websiteUrl,
        productDescription: brandMemory.productDescription || undefined,
        toneOfVoice: brandMemory.toneOfVoice || undefined,
      },
      select: {
        id: true,
        name: true,
        websiteUrl: true,
        productDescription: true,
        toneOfVoice: true,
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
    console.error("Brand analysis error:", error)
    return NextResponse.json(
      { ok: false, error: { message: error?.message || "Failed to analyze website brand" } },
      { status: 500 }
    )
  }
}
