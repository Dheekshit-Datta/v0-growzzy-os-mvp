import { NextResponse } from "next/server"
import OpenAI from "openai"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId } from "@/lib/workspace"
import { scoreCreativeVariation } from "@/lib/marketing-logic"
import { recordActivity } from "@/lib/activity-log"
import { getBusinessContextForWorkspace } from "@/lib/business-context"
import { rateLimitPolicy, rateLimitResponse } from "@/lib/rate-limit"
import { assertCreditsAvailable, estimatedCredits, recordCreditUsage, recordFixedCreditUsage, CreditQuotaError } from "@/lib/ai-credits"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" })

const CreativeBriefSchema = z.object({
  workspaceId: z.string().optional(),
  adAccountId: z.string().optional(),
  campaignId: z.string().optional(),
  brandName: z.string().optional(),
  businessName: z.string().optional(),
  industry: z.string().optional(),
  brandTone: z.string().optional(),
  objective: z.string().optional(),
  platform: z.string().optional(),
  format: z.string().optional(),
  productName: z.string().optional(),
  valueProp: z.string().optional(),
  painPoint: z.string().optional(),
  socialProof: z.string().optional(),
  cta: z.string().optional(),
  offer: z.string().optional(),
  targetPersona: z.string().optional(),
  ageRange: z.string().optional(),
  location: z.string().optional(),
  visualStyle: z.string().optional(),
  variations: z.number().min(1).max(10).optional(),
  targetAudience: z.string().optional(),
  adFormat: z.string().optional(),
  tone: z.string().optional(),
  productDescription: z.string().optional(),
  generateImages: z.boolean().optional(),
})

function publicAiError(error: any) {
  const message = String(error?.message || "")
  if (error?.status === 429 || /quota|rate limit/i.test(message)) {
    return "AI quota is exhausted right now. Check the OpenAI billing/quota on the production API key, then try again."
  }
  return "AI creative generation failed. Please try again."
}

function buildImagePrompt(input: z.infer<typeof CreativeBriefSchema>, variation: any, businessContext: string) {
  return `Create a high-converting digital ad image for ${input.platform || "Google Display"}.
Brand: ${input.businessName || input.brandName || "User brand"}
Product/service: ${input.productName || input.productDescription || "Not provided"}
Audience: ${input.targetPersona || input.targetAudience || "Not provided"}
Key message: ${variation.headline || input.valueProp || "Not provided"}
Ad objective: ${input.objective || "Conversions"}
Visual style: ${input.visualStyle || input.brandTone || input.tone || "Professional"}
Requirements: premium SaaS ad quality, clear focal point, minimal embedded text, no watermarks, leave bottom area usable for copy overlay.
${businessContext}`
}

async function generateImageUrls(input: z.infer<typeof CreativeBriefSchema>, variations: any[], businessContext: string) {
  if (!process.env.OPENAI_API_KEY || input.generateImages === false) return { urls: [] as string[], error: null as string | null }
  try {
    const targets = variations.slice(0, Math.min(3, variations.length))
    const imageModel = process.env.OPENAI_IMAGE_MODEL || "dall-e-3"
    const responses = await Promise.all(
      targets.map((variation, index) =>
        openai.images.generate({
          model: imageModel,
          prompt: `${buildImagePrompt(input, variation, businessContext)}\nVariation ${index + 1}: ${index === 0 ? "primary composition" : index === 1 ? "different layout" : "different color treatment"}.`,
          size: "1024x1024",
          quality: "standard",
        })
      )
    )
    const urls = responses
      .map((response) => {
        const image = response.data?.[0]
        if (image?.url) return image.url
        if (image?.b64_json) return `data:image/png;base64,${image.b64_json}`
        return null
      })
      .filter(Boolean) as string[]
    return { urls, error: urls.length ? null : "OpenAI did not return image assets" }
  } catch (error: any) {
    console.warn("Image generation fallback triggered:", error?.message || error)
    return { urls: [] as string[], error: publicAiError(error) }
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    const userId = await resolveUserId(session.user.id)
    const input = CreativeBriefSchema.parse(await request.json())
    const textLimit = await rateLimitPolicy(userId, "creativeText")
    if (!textLimit.allowed) return rateLimitResponse(textLimit)
    if (input.generateImages !== false) {
      const imageLimit = await rateLimitPolicy(userId, "imageGeneration")
      if (!imageLimit.allowed) return rateLimitResponse(imageLimit)
    }
    const workspaceId = await getRequestWorkspaceId(userId, request as any)
    const requestedCount = input.variations || 3
    const businessContext = await getBusinessContextForWorkspace(workspaceId)

    const campaign = input.campaignId
      ? await prisma.campaign.findFirst({
          where: { id: input.campaignId, userId, workspaceId },
          select: { id: true, adAccountId: true, name: true, objective: true, platform: true, spend: true, roas: true },
        })
      : null
    const selectedIntegration = await prisma.integration.findFirst({
      where: {
        userId,
        workspaceId,
        platform: String(input.platform || campaign?.platform || "GOOGLE").toUpperCase() as any,
        hasAdsAccess: true,
        status: { in: ["OAUTH_GRANTED", "ACCOUNT_SELECTED", "INITIAL_SYNC_RUNNING", "ACTIVE", "SYNC_FAILED"] },
      },
      select: { selectedAdAccountId: true, accountId: true },
    })
    const selectedAdAccountId = selectedIntegration?.selectedAdAccountId || selectedIntegration?.accountId || null
    if (input.adAccountId && input.adAccountId !== selectedAdAccountId && input.adAccountId !== campaign?.adAccountId) {
      return NextResponse.json({ success: false, code: "ACCOUNT_SCOPE_MISMATCH", error: "The selected ad account does not belong to this active workspace connection." }, { status: 403 })
    }
    const adAccountId = campaign?.adAccountId || selectedAdAccountId

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          code: "AI_UNAVAILABLE",
          error: "AI creative generation is unavailable because OPENAI_API_KEY is not configured.",
        },
        { status: 503 }
      )
    }
    const textModel = process.env.OPENAI_CREATIVE_MODEL || "gpt-4o"
    const imageModel = process.env.OPENAI_IMAGE_MODEL || "dall-e-3"
    const imageCount = input.generateImages === false ? 0 : Math.min(3, requestedCount)
    const imageCredits = Number(process.env.AI_IMAGE_CREDITS || 100)
    await assertCreditsAvailable(workspaceId, estimatedCredits(textModel) + imageCount * imageCredits)

    let variations: any[] = []

    {
      const system = `You are a senior direct-response creative strategist for paid acquisition teams. Produce materially different, campaign-ready variations, not generic marketing slogans.
Rules:
- Lead with the biggest benefit, not the feature
- Translate the provided pain into one concrete promise per variation
- Vary angles across proof, urgency, objection handling, outcome, and contrast where facts support them
- Include social proof only when supplied; never invent proof, results, or claims
- Match brand tone and platform/format constraints
- CTA must be specific and low-friction
- Explain the conversion hypothesis for each variation
- Return ONLY JSON: {"variations":[{"headline":"max 40 chars for Meta or 30 for Google","body":"max 125 chars","description":"short support line","cta":"button text","visualDirection":"image/video concept","whyThisWorks":"strategy","angle":"curiosity|fear|desire|social_proof|urgency"}]}`
      const user = `Generate ${requestedCount} ad creative variations.
Brand: ${input.businessName || "GROWZZY OS user brand"}
Industry: ${input.industry || "Not provided"}
Tone: ${input.brandTone || input.tone || "Professional"}
Campaign: ${campaign?.name || "New campaign"}
Objective: ${input.objective || campaign?.objective || "Conversions"}
Platform/Format: ${input.platform || campaign?.platform || "Google"} / ${input.format || input.adFormat || "Static Image"}
Product: ${input.productName || input.productDescription || "Not provided"}
Value prop: ${input.valueProp || "Not provided"}
Pain point: ${input.painPoint || "Not provided"}
Offer: ${input.offer || "Not provided"}
Social proof: ${input.socialProof || "Not provided"}
CTA: ${input.cta || "Book Free Demo"}
Audience: ${input.targetPersona || input.targetAudience || "Not provided"}
Location: ${input.location || "Not provided"}${businessContext}`

      const completion = await openai.chat.completions.create({
        model: textModel,
        temperature: 0.65,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      })
      await recordCreditUsage({ workspaceId, userId, route: "/api/ai/generate-creatives", model: textModel, inputTokens: completion.usage?.prompt_tokens, outputTokens: completion.usage?.completion_tokens })

      const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}")
      if (Array.isArray(parsed.variations) && parsed.variations.length) variations = parsed.variations
    }

    if (!variations.length) {
      return NextResponse.json({ success: false, error: "AI did not return usable creative variations. Please try again." }, { status: 502 })
    }

    const scored = variations.slice(0, requestedCount).map((variation) => {
      const score = scoreCreativeVariation({
        headline: variation.headline,
        body: variation.body,
        description: variation.description,
        cta: variation.cta,
        targetPersona: input.targetPersona || input.targetAudience,
        painPoint: input.painPoint,
        valueProp: input.valueProp,
        socialProof: input.socialProof,
      })
      return { ...variation, ...score }
    })

    const imageResult = await generateImageUrls(input, scored, businessContext)
    if (imageResult.urls.length) {
      await recordFixedCreditUsage({ workspaceId, userId, route: "/api/ai/generate-creatives", model: imageModel, credits: imageResult.urls.length * imageCredits })
    }

    const creative = await prisma.generatedCreative.create({
      data: {
        workspaceId,
        adAccountId,
        userId,
        campaignId: campaign?.id || input.campaignId || null,
        brief: input,
        variations: scored,
        imageUrls: imageResult.urls,
        assets: { imageError: imageResult.error },
        headlines: scored.map((item) => item.headline),
        descriptions: scored.map((item) => item.description || item.body),
        score: Math.round(scored.reduce((sum, item) => sum + item.score, 0) / Math.max(1, scored.length)),
        scoreBreakdown: scored.map((item) => ({ headline: item.headline, score: item.score, breakdown: item.breakdown })),
      },
    })

    await recordActivity({
      userId,
      workspaceId,
      adAccountId,
      type: "CREATIVES_GENERATED",
      title: "AI creatives generated",
      message: `${scored.length} scored creative variations generated.`,
      entityType: "GeneratedCreative",
      entityId: creative.id,
      metadata: { score: creative.score, campaignId: campaign?.id || input.campaignId || null },
    })

    return NextResponse.json({
      success: true,
      ok: true,
      creativeId: creative.id,
      creative,
      variations: scored,
      imageUrls: imageResult.urls,
      imageError: imageResult.error,
      data: { variations: scored, imageUrls: imageResult.urls, imageError: imageResult.error },
    })
  } catch (error: any) {
    if (error instanceof CreditQuotaError) return NextResponse.json({ success: false, code: error.code, error: "Monthly credit quota exceeded. Try again after the workspace credits reset." }, { status: 402 })
    return NextResponse.json({ success: false, code: "AI_CREATIVE_FAILED", error: publicAiError(error) }, { status: error?.status === 429 ? 429 : 500 })
  }
}
