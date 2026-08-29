import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId } from "@/lib/workspace"
import { recordActivity } from "@/lib/activity-log"
import { accountIdVariants, normalizeAccountId } from "@/lib/account-id"
import { getBusinessContextForWorkspace, normalizeBusinessContext } from "@/lib/business-context"
import { rateLimitPolicy, rateLimitResponse } from "@/lib/rate-limit"
import { parseGoogleSearchPlan, BANNED_FILLER_PHRASES } from "@/lib/google-plan-quality"
import { scoreCreativeQuality } from "@/lib/creative-quality-score"
import { checkPlanPolicy } from "@/lib/services/policy-check"
import { aiErrorMetadata, aiUnavailableMessage } from "@/lib/ai-utility"
import { assertCreditsAvailable, estimatedCredits, recordCreditUsage, CreditQuotaError } from "@/lib/ai-credits"
import { log } from "@/lib/logger"

import { buildPsychologyPromptContext, BuyerPsychologyProfile } from "@/lib/ad-psychology-engine"
import { analyzeLandingPageSentiment } from "@/lib/landing-page-sentiment"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" })

const CampaignBuilderSchema = z.object({
  platform: z.enum(["GOOGLE", "META"]).default("GOOGLE"),
  workspaceId: z.string().optional(),
  adAccountId: z.string().optional(),
  offer: z.string().min(3, "Tell us what you sell"),
  landingPageUrl: z.string().url().optional().or(z.literal("")),
  targetCustomer: z.string().min(3, "Add a target customer"),
  budget: z.coerce.number().positive("Budget must be greater than 0"),
  location: z.string().min(2, "Add a target location").max(120),
  goal: z.string().min(2).max(80),
  imageUrl: z.string().url().optional().or(z.literal("")),
  metaObjective: z.enum(["AWARENESS", "TRAFFIC", "ENGAGEMENT", "LEADS", "SALES", "APP_PROMOTION"]).optional(),
  objectStoreUrl: z.string().url().optional().or(z.literal("")),
  enhancedBrief: z.object({
    enhancedText: z.string().min(20).max(2000),
    productOrOffer: z.string().min(2).max(300),
    targetCustomer: z.string().min(2).max(500),
    painPoints: z.array(z.string().max(200)).max(4),
    differentiators: z.array(z.string().max(200)).max(4),
    proofPoints: z.array(z.string().max(200)).max(4),
    geography: z.string().max(120),
    goal: z.string().max(80),
    tone: z.string().max(80),
    restrictions: z.array(z.string().max(200)).max(4),
    missingQuestions: z.array(z.string().max(180)).max(3),
  }).optional(),
  clarifications: z.array(z.object({ question: z.string().max(180), answer: z.string().min(1).max(500) })).max(3).optional(),
})

const META_OBJECTIVES = {
  AWARENESS: { objective: "OUTCOME_AWARENESS", optimizationGoal: "REACH", billingEvent: "IMPRESSIONS" },
  TRAFFIC: { objective: "OUTCOME_TRAFFIC", optimizationGoal: "LINK_CLICKS", billingEvent: "IMPRESSIONS" },
  ENGAGEMENT: { objective: "OUTCOME_ENGAGEMENT", optimizationGoal: "POST_ENGAGEMENT", billingEvent: "IMPRESSIONS" },
  LEADS: { objective: "OUTCOME_LEADS", optimizationGoal: "OFFSITE_CONVERSIONS", billingEvent: "IMPRESSIONS" },
  SALES: { objective: "OUTCOME_SALES", optimizationGoal: "OFFSITE_CONVERSIONS", billingEvent: "IMPRESSIONS" },
  APP_PROMOTION: { objective: "OUTCOME_APP_PROMOTION", optimizationGoal: "APP_INSTALLS", billingEvent: "IMPRESSIONS" },
} as const

function object(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {}
}

export function parseJsonObject(content?: string | null) {
  const text = (content || "").trim()
  if (!text) throw new Error("EMPTY_AI_RESPONSE")
  try {
    return JSON.parse(text)
  } catch {
    const match = balancedJsonExtract(text)
    if (match) return JSON.parse(match)
    throw new Error("INVALID_AI_JSON")
  }
}

/**
 * Extract the first balanced JSON object from arbitrary text.
 * Uses a brace counter so `}` characters inside JSON strings do not
 * truncate the match (greedy `/\{[\s\S]*\}/` would).
 */
function balancedJsonExtract(text: string): string | null {
  let depth = 0
  let inString = false
  let escaped = false
  let start = -1

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (escaped) { escaped = false; continue }
    if (ch === "\\") { escaped = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === "{") {
      if (depth === 0) start = i
      depth += 1
    } else if (ch === "}") {
      depth -= 1
      if (depth === 0 && start !== -1) return text.slice(start, i + 1)
    }
  }
  return null
}

function metaTargeting(value: unknown, countryCode: string) {
  const input = object(value)
  const geo = object(input.geo_locations)
  const countries = (Array.isArray(geo.countries) ? geo.countries : [countryCode])
    .map((item) => String(item).trim().toUpperCase())
    .filter((item) => /^[A-Z]{2}$/.test(item))
    .slice(0, 25)
  const interests = (Array.isArray(input.interests) ? input.interests : [])
    .map((item) => object(item))
    .filter((item) => /^\d+$/.test(String(item.id || "")) && item.name)
    .slice(0, 50)
    .map((item) => ({ id: String(item.id), name: String(item.name).slice(0, 120) }))
  return {
    geo_locations: { countries: countries.length ? countries : ["US"] },
    age_min: Math.max(18, Math.min(65, Number(input.age_min) || 18)),
    age_max: Math.max(18, Math.min(65, Number(input.age_max) || 65)),
    ...(Array.isArray(input.genders) ? { genders: input.genders.map(Number).filter((item) => item === 1 || item === 2).slice(0, 2) } : {}),
    ...(interests.length ? { interests } : {}),
  }
}

function metaPlacements(value: unknown) {
  const input = object(value)
  const allowed = (key: string, values: string[]) => (Array.isArray(input[key]) ? input[key].map(String).filter((item) => values.includes(item)) : [])
  const publisherPlatforms = allowed("publisher_platforms", ["facebook", "instagram", "messenger", "audience_network"])
  const facebookPositions = allowed("facebook_positions", ["feed", "right_hand_column", "instant_article", "marketplace", "video_feeds", "story", "reels"])
  const instagramPositions = allowed("instagram_positions", ["stream", "story", "explore", "reels", "profile_feed"])
  return {
    ...(publisherPlatforms.length ? { publisher_platforms: publisherPlatforms } : {}),
    ...(facebookPositions.length ? { facebook_positions: facebookPositions } : {}),
    ...(instagramPositions.length ? { instagram_positions: instagramPositions } : {}),
  }
}

function validateMetaPlan(plan: any, input: z.infer<typeof CampaignBuilderSchema>, assets: Record<string, any>) {
  // Validate metaObjective is provided when platform is META
  if (input.platform === "META" && !input.metaObjective) {
    throw new Error("META_OBJECTIVE_REQUIRED")
  }

  const kind = input.metaObjective
  // Validate that the objective is valid for Meta
  if (!META_OBJECTIVES[kind as keyof typeof META_OBJECTIVES]) {
    throw new Error(`INVALID_META_OBJECTIVE: ${kind}`)
  }

  const objective = META_OBJECTIVES[kind as keyof typeof META_OBJECTIVES]
  return {
    platform: "META",
    campaignName: String(plan?.campaignName || "AI Meta Campaign").slice(0, 120),
    objective: objective.objective,
    dailyBudget: input.budget,
    adSetName: String(plan?.adSetName || `${plan?.campaignName || "AI Meta Campaign"} Ad Set`).slice(0, 120),
    optimizationGoal: objective.optimizationGoal,
    billingEvent: objective.billingEvent,
    targeting: metaTargeting(plan?.targeting, String(plan?.countryCode || "US")),
    placements: metaPlacements(plan?.placements),
    pageId: assets.pageId || null,
    instagramActorId: assets.instagramActorId || null,
    pixelId: assets.pixelId || null,
    appId: assets.appId || null,
    objectStoreUrl: input.objectStoreUrl || null,
    creative: {
      name: String(plan?.creative?.name || `${plan?.campaignName || "AI Meta Campaign"} Ad`).slice(0, 120),
      primaryText: String(plan?.creative?.primaryText || input.offer).slice(0, 2200),
      headline: String(plan?.creative?.headline || input.offer).slice(0, 255),
      description: String(plan?.creative?.description || "").slice(0, 255),
      imageUrl: input.imageUrl || String(plan?.creative?.imageUrl || ""),
      destinationUrl: input.landingPageUrl || String(plan?.creative?.destinationUrl || ""),
      callToAction: String(plan?.creative?.callToAction || (kind === "LEADS" ? "SIGN_UP" : kind === "SALES" ? "SHOP_NOW" : "LEARN_MORE")),
    },
    rationale: String(plan?.rationale || "").slice(0, 800),
    launchReadinessScore: Math.max(0, Math.min(100, Number(plan?.launchReadinessScore || 60))),
    risks: Array.isArray(plan?.risks) ? plan.risks.slice(0, 5) : [],
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = await resolveUserId(session.user.id)
  const limit = await rateLimitPolicy(userId, "campaignPlan")
  if (!limit.allowed) return rateLimitResponse(limit)
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: { code: "INVALID_JSON", message: "Invalid request body." } }, { status: 400 })
  }
  const parsed = CampaignBuilderSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ ok: false, error: { code: "INVALID_INPUT", message: parsed.error.issues[0]?.message || "Invalid campaign brief." } }, { status: 400 })
  const input = parsed.data
  if (input.platform === "META" && process.env.ENABLE_META_ADS !== "true") {
    return NextResponse.json({ ok: false, error: { code: "META_DISABLED", message: "Meta Ads is not enabled yet." } }, { status: 404 })
  }
  const workspaceId = await getRequestWorkspaceId(userId, req)
  // Get integration if available (optional for plan generation)
  const integration = await prisma.integration.findFirst({
    where: {
      userId,
      workspaceId,
      platform: input.platform,
      status: { in: ["OAUTH_GRANTED", "ACCOUNT_SELECTED", "INITIAL_SYNC_RUNNING", "ACTIVE", "SYNC_FAILED"] },
    },
    select: { id: true, selectedAdAccountId: true, accountId: true, accountInfo: true },
  })
  const selectedAdAccountId = integration?.selectedAdAccountId || integration?.accountId || null

  // Validate provided adAccountId if given
  if (input.adAccountId) {
    const normalizedInputId = normalizeAccountId(input.adAccountId)
    const normalizedAccountIdFromIntegration = selectedAdAccountId ? normalizeAccountId(selectedAdAccountId) : null

    if (normalizedInputId !== normalizedAccountIdFromIntegration) {
      return NextResponse.json({ ok: false, error: { code: "ACCOUNT_SCOPE_MISMATCH", message: `The selected ${input.platform === "META" ? "Meta" : "Google"} Ads account is not active in this workspace.` } }, { status: 403 })
    }
  }

  // Get ad account details if integration exists
  const adAccount = integration ? await prisma.adAccount.findFirst({
    where: {
      integrationId: integration.id,
      OR: [
        { externalId: { in: accountIdVariants(selectedAdAccountId) } },
        { isPrimary: true },
      ],
    },
    select: { id: true, externalId: true },
  }) : null

  // Use adAccountId if available, otherwise null (allowed by schema)
  const adAccountId = adAccount?.id ?? null
  const rawBusinessContext = await getBusinessContextForWorkspace(workspaceId)
  const businessContext = normalizeBusinessContext(rawBusinessContext)

  // Landing page sentiment analysis (if URL provided)
  let landingPageSentiment: Awaited<ReturnType<typeof analyzeLandingPageSentiment>> | null = null
  if (input.landingPageUrl) {
    try {
      landingPageSentiment = await analyzeLandingPageSentiment(input.landingPageUrl, input.offer)
    } catch (error) {
      log("warn", "ai/campaign-builder", "Landing page sentiment analysis failed; continuing", aiErrorMetadata(error))
    }
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ ok: false, error: { code: "AI_UNAVAILABLE", message: "AI campaign generation is temporarily unavailable. Your brief is safe; try again shortly." } }, { status: 503 })
  }
  const estimated = estimatedCredits(process.env.OPENAI_CAMPAIGN_BUILDER_MODEL || "gpt-4o")
  try {
    await assertCreditsAvailable(workspaceId, estimated)
  } catch (error) {
    if (error instanceof CreditQuotaError) return NextResponse.json({ ok: false, error: { code: error.code, message: "Monthly credit quota exceeded. Try again after the workspace credits reset." } }, { status: 402 })
    throw error
  }

  const psychologyProfile = await buildPsychologyPromptContext({
    offer: input.offer,
    targetCustomer: input.targetCustomer,
    goal: input.goal,
    brandMemory: businessContext,
    landingPageUrl: input.landingPageUrl,
    workspaceId,
    userId,
  })

  const awarenessDirective = (stage: string) => {
    switch (stage) {
      case "PROBLEM_AWARE":
        return "Lead every ad group with visceral pain. Open headlines with the problem the user experiences daily but hasn't solved."
      case "SOLUTION_AWARE":
        return "Lead with the unique mechanism and speed. The user knows solutions exist — show them why this specific approach works faster/better."
      case "PRODUCT_AWARE":
        return "Lead with differentiation vs named alternatives. Emphasize why competitors fail and why this is the superior choice."
      case "MOST_AWARE":
        return "Lead with the risk-reversal offer, pricing, or strong CTA. The user is ready to buy — remove all friction."
      default:
        return "Lead with high-intent pain points and quantifiable desired outcomes."
    }
  }

  const model = process.env.OPENAI_CAMPAIGN_BUILDER_MODEL || "gpt-4o"
  let plan: any
  let quality: ReturnType<typeof parseGoogleSearchPlan>["quality"] | undefined

  if (input.platform === "META") {
    // Meta Ads Single-Pass Generation
    const metaSystemPrompt = `You are a world-class Performance Marketing Creative Director specializing in direct-response paid social advertising.
Non-negotiable direct-response advertising rules:
- Return ONLY valid JSON matching the schema provided. No markdown code blocks, no conversational preamble.
- Primary text: compelling hook, problem agitation, clear value proposition, and crisp CTA.
- Headline: punchy benefit or hook (max 255 chars).
- Description: social proof or risk reversal (max 255 chars).
- Creative visual direction: detailed concept for high-CTR pattern interrupt.
- No fabricated stats, false guarantees (e.g. '100% Guaranteed'), or '#1' claims.`

    const metaPromptLines = [
      `Build one elite, launch-ready Meta Ads campaign draft.`,
      `Offer: ${input.offer}`,
      `Audience Persona: ${input.targetCustomer} (${psychologyProfile.targetPersona})`,
      `Awareness Stage: ${psychologyProfile.awarenessStage}`,
      `Core Pain Points: ${psychologyProfile.corePainPoints.join(" | ")}`,
      `Core Desires: ${psychologyProfile.desireOutcomes.join(" | ")}`,
      `Emotional Trigger: ${psychologyProfile.primaryEmotionalTrigger}`,
      `Visual Direction: ${psychologyProfile.recommendedVisualPrompt}`,
      `Budget: $${input.budget}/day`,
      `Objective: ${input.metaObjective || input.goal}`,
    ]
    if (input.landingPageUrl) metaPromptLines.push(`Destination: ${input.landingPageUrl}`)
    if (businessContext) metaPromptLines.push(`Brand Context: ${businessContext}`)
    metaPromptLines.push(`Return ONLY JSON with campaignName, adSetName, countryCode (ISO-2), targeting (Meta targeting object with geo_locations), placements (publisher_platforms and facebook_positions/instagram_positions when appropriate), creative { name, primaryText, headline, description, callToAction }, rationale, launchReadinessScore, and risks. Do not invent a Page, Pixel, app, destination URL, or image URL.`)

    const metaPrompt = metaPromptLines.join("\n")

    let rawMeta: any
    let metaError: unknown
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const completion = await openai.chat.completions.create({
          model,
          temperature: 0.3,
          response_format: { type: "json_object" as const },
          messages: [
            { role: "system" as const, content: metaSystemPrompt },
            { role: "user" as const, content: `${metaPrompt}${attempt ? "\n\nThe previous response failed JSON validation. Return complete, valid JSON matching every field strictly." : ""}` },
          ],
        })
        await recordCreditUsage({
          workspaceId,
          userId,
          route: "/api/ai/campaign-builder",
          model,
          inputTokens: completion.usage?.prompt_tokens,
          outputTokens: completion.usage?.completion_tokens,
        })
        rawMeta = parseJsonObject(completion.choices[0]?.message?.content)
        if (rawMeta) break
      } catch (error) {
        metaError = error
        log("error", "ai/campaign-builder", "Meta campaign generation failed", aiErrorMetadata(error))
      }
    }

    if (!rawMeta) {
      return NextResponse.json({ ok: false, error: { code: "AI_INVALID_OUTPUT", message: "AI could not produce a safe Meta campaign plan. Add more specific offer and audience details, then retry." } }, { status: 502 })
    }

    plan = validateMetaPlan(rawMeta, input, object(object(integration?.accountInfo).metaAssets))
  } else {
    // Google Search Two-Pass Generation
    // =========================================================================
    // PASS 1: Campaign Shell & Architecture (Keywords, Ad Groups, Bidding, DALL-E Prompt, Strategy) @ temp 0.2
    // =========================================================================
    const pass1SystemPrompt = `You are a world-class Google Ads Architect and Strategic Media Buyer with 20+ years direct-response experience.
Non-negotiable direct-response architectural rules:
- Return ONLY valid JSON matching the schema provided. No markdown code blocks, no conversational preamble.
- Construct 2-3 tightly-themed ad groups based on DISTINCT high-commercial search intents (informational, navigational, transactional).
- Generate 10-20 high-performing keywords per ad group (Phrase & Exact match), with ≥60% labeled "high" intent.
- Derive 5-8 negative keywords per ad group specific to the offer and irrelevant intents (jobs, free, cheap, salary, crack, login, tutorial). NEVER reuse a generic static list.
- Bidding strategy: MUST be MAXIMIZE_CONVERSIONS, MAXIMIZE_CLICKS, or TARGET_CPA.
- ENGINEER AN ELITE DALL-E 3 IMAGE PROMPT: Subject + specific action + studio lighting + color harmony + emotional contrast. NO text in image.
- PSYCHOLOGICAL FOUNDATION: Your architecture must support the awareness-stage directive and emotional lever below.

ARCHITECTURE QUALITY CHECKLIST (self-validate before output):
☐ Each ad group has a clear, distinct search intent (not just "theme")
☐ Keyword intent distribution: ≥60% high, ≤40% medium
☐ Negative keywords are offer-specific, never generic
☐ Bidding strategy matches campaign goal and awareness stage
☐ Image prompt describes subject, action, lighting, color, emotion
☐ Rationale explains WHY this structure works for this specific psychology
`

    const pass1PromptLines = [
      `Synthesize a high-converting Google Search Campaign Shell on this brief:`,
      `1. Offer & Mechanism: ${input.offer}`,
      `2. Target Customer Persona: ${input.targetCustomer} (Role: ${psychologyProfile.targetPersona})`,
      `3. Awareness Level: ${psychologyProfile.awarenessStage}`,
      `4. Core Pain Points to Address: ${psychologyProfile.corePainPoints.join(" | ")}`,
      `5. Desired Outcomes to Highlight: ${psychologyProfile.desireOutcomes.join(" | ")}`,
      `6. Emotional Lever: ${psychologyProfile.primaryEmotionalTrigger}`,
      `7. Daily Budget: $${input.budget}/day in ${input.location}`,
      `8. Goal: ${input.goal}`,
    ]
    if (input.landingPageUrl) pass1PromptLines.push(`9. Landing Page: ${input.landingPageUrl}`)
    if (businessContext) pass1PromptLines.push(`10. Brand Context: ${businessContext}`)

    pass1PromptLines.push(`
Return ONLY JSON matching this schema (field names are exact; do not rename them):
{
  "campaignName": "High-converting campaign name",
  "campaignType": "SEARCH",
  "objective": "LEADS|SALES|TRAFFIC|AWARENESS",
  "biddingStrategy": "MAXIMIZE_CONVERSIONS|MAXIMIZE_CLICKS|TARGET_CPA",
  "targetCpa": null,
  "dailyBudget": ${input.budget},
  "finalUrl": ${input.landingPageUrl ? JSON.stringify(input.landingPageUrl) : "null"},
  "locations": ["${input.location}"],
  "languages": ["English"],
  "imagePrompt": "DALL-E 3 prompt — BUILD ON the visual foundation: ${psychologyProfile.recommendedVisualPrompt}. Refine with specific subject, composition, studio lighting, visual color harmony, high contrast. Do NOT include any text or words in the image.",
  "adGroups": [
    {
      "name": "Ad group name",
      "theme": "Specific search intent theme",
      "keywords": [{"text":"keyword","matchType":"PHRASE|EXACT|BROAD","intent":"high|medium"}],
      "negativeKeywords": ["5-8 derived negative keywords specific to this offer"]
    }
  ],
  "rationale": {
    "whyThisStructure": "detailed strategic rationale",
    "whyTheseKeywords": "keyword strategy rationale",
    "whyThisBidding": "bidding strategy rationale",
    "expectedResultsRange": "estimated ROI / conversion range"
  },
  "landingPageSuggestions": ["CRO recommendations"],
  "launchReadinessScore": 85,
  "risks": ["risk factors"]
}`)

    const pass1Prompt = pass1PromptLines.join("\n")

    let shellRaw: any
    let shellError: unknown
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const completion = await openai.chat.completions.create({
          model,
          temperature: 0.2,
          response_format: { type: "json_object" as const },
          messages: [
            { role: "system" as const, content: pass1SystemPrompt },
            { role: "user" as const, content: `${pass1Prompt}${attempt ? "\n\nThe previous attempt failed JSON structure. Return complete, valid JSON strictly adhering to schema and distinct keywords per ad group." : ""}` },
          ],
        })
        await recordCreditUsage({
          workspaceId,
          userId,
          route: "/api/ai/campaign-builder",
          model,
          inputTokens: completion.usage?.prompt_tokens,
          outputTokens: completion.usage?.completion_tokens,
        })
        shellRaw = parseJsonObject(completion.choices[0]?.message?.content)
        if (shellRaw?.adGroups && Array.isArray(shellRaw.adGroups) && shellRaw.adGroups.length >= 1) break
      } catch (error) {
        shellError = error
        log("error", "ai/campaign-builder", "Pass 1 Google Shell generation failed", aiErrorMetadata(error))
      }
    }

    if (!shellRaw || !Array.isArray(shellRaw.adGroups) || shellRaw.adGroups.length === 0) {
      return NextResponse.json({ ok: false, error: { code: "AI_INVALID_OUTPUT", message: "AI could not generate the campaign architecture. Add more specific offer details, then retry." } }, { status: 502 })
    }

    // =========================================================================
    // PASS 2: Direct-Response RSA Creative Generation Per Ad Group @ temp 0.7
    // =========================================================================
    const pass2SystemPrompt = `You are the world's best direct-response copywriter. You write ads that make people stop, feel, and click.

COPYWRITING STANDARDS — every headline must pass ALL of these:

THE 4U's TEST:
✗ BAD: "Get More Leads" (vague, no specificity, no urgency)
✓ GOOD: "Close 40% More Leads in 30 Days" (specific, quantified, outcome-driven)

EMOTIONAL TRIGGER TEST:
✗ BAD: "Best CRM Software" (feature claim, no emotion)
✓ GOOD: "Stop Losing Leads to Your Competitors" (fear of loss, visceral)

CURiosity gap test:
✗ BAD: "Our AI Tool Saves Time" (complete statement, no gap)
✓ GOOD: "The 7-Minute Fix for 4-Hour Tasks" (opens a curiosity gap)

PAIN vs FEATURE TEST:
✗ BAD: "Cloud-based, AI-powered CRM" (features nobody asked about)
✓ GOOD: "Finally, a CRM Your Team Will Actually Use" (addresses adoption fear)

SPECIFICITY TEST:
✗ BAD: "Save time and money" (generic)
✓ GOOD: "Cut admin by 3 hours/week — free in 14 days" (quantified, risk-reversed)

HEADLINE FORMULA (use at least one per ad group):
- NUMBER + OUTCOME: "Close 40% More Leads in 30 Days"
- FEAR OF LOSS: "Stop Losing Deals to Competitors"
- HOW-TO FRAME: "How [Specific Audience] Gets [Specific Outcome]"
- CURIOSITY GAP: "The [X]-Minute Fix for [Pain]"
- SOCIAL PROOF: "500+ [Persona] Trust This Approach"
- CONTRAST/BEFORE-AFTER: "From [Bad] to [Great] in [Time]"

DESCRIPTION FORMULA — each description must include:
- WHO this is for (specific persona)
- WHAT transformation they're getting
- WHY it's different from alternatives
- CTA that removes friction

BANNED PHRASES: 'Unlock AI Efficiency' | 'Revitalize Operations' | 'Transform Your Business' | 'Reduce Costs With AI' | 'Seamless' | 'Revolutionary' | 'Best-in-Class' | 'World-Class' | 'State-of-the-Art' | 'Holistic'

STRUCTURAL RULES:
- 10-15 headlines, EACH strictly <= 30 characters
- 3-4 descriptions, EACH strictly <= 90 characters
- Minimum 3 headlines MUST contain the offer name or brand token
- Cover ALL 5 psychological angles across your headlines: Pain, Solution, Outcome, Proof, CTA
- AWARENESS DIRECTIVE: ${awarenessDirective(psychologyProfile.awarenessStage)}
- No fabricated stats, no "#1" claims, no "100% Guaranteed"

RETURN ONLY valid JSON matching the schema. No preamble.`

    let pass2FailedGroup: string | null = null

    const adGroupsWithCreatives = await Promise.all(
      shellRaw.adGroups.map(async (group: any, idx: number) => {
        const pass2UserPrompt = `Generate direct-response Responsive Search Ad (RSA) copy for this ad group:
Ad Group Name: ${group.name}
Theme: ${group.theme}
Keywords: ${JSON.stringify((group.keywords || []).map((k: any) => k.text || k))}
Offer: ${input.offer}
Target Customer: ${input.targetCustomer} (${psychologyProfile.targetPersona})
Awareness Stage: ${psychologyProfile.awarenessStage}
Awareness Directive: ${awarenessDirective(psychologyProfile.awarenessStage)}
Core Pain Points: ${psychologyProfile.corePainPoints.join(" | ")}
Desired Outcomes: ${psychologyProfile.desireOutcomes.join(" | ")}
Emotional Trigger: ${psychologyProfile.primaryEmotionalTrigger}
${businessContext ? `Brand Context: ${businessContext}` : ""}

Return ONLY JSON:
{
  "headlines": ["10-15 unique headlines, strictly <= 30 characters each"],
  "descriptions": ["3-4 compelling descriptions, strictly <= 90 characters each"]
}`

        let headlines: string[] = []
        let descriptions: string[] = []

        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            const completion = await openai.chat.completions.create({
              model,
              temperature: 0.7,
              response_format: { type: "json_object" as const },
              messages: [
                { role: "system" as const, content: pass2SystemPrompt },
                { role: "user" as const, content: `${pass2UserPrompt}${attempt ? "\n\nThe previous response had fewer than 8 headlines or 3 descriptions. Return at least 10 headlines (<=30 chars each) and 3-4 descriptions (<=90 chars each)." : ""}` },
              ],
            })
            await recordCreditUsage({
              workspaceId,
              userId,
              route: "/api/ai/campaign-builder",
              model,
              inputTokens: completion.usage?.prompt_tokens,
              outputTokens: completion.usage?.completion_tokens,
            })
            const creativeRaw = parseJsonObject(completion.choices[0]?.message?.content)
            if (Array.isArray(creativeRaw.headlines)) {
              headlines = creativeRaw.headlines.map((h: any) => String(typeof h === "object" ? h.text || "" : h).trim()).filter((h: string) => h.length > 0 && h.length <= 30).slice(0, 15)
            }
            if (Array.isArray(creativeRaw.descriptions)) {
              descriptions = creativeRaw.descriptions.map((d: any) => String(typeof d === "object" ? d.text || "" : d).trim()).filter((d: string) => d.length > 0 && d.length <= 90).slice(0, 4)
            }
            if (headlines.length >= 8 && descriptions.length >= 3) break
          } catch (error) {
            log("error", "ai/campaign-builder", `Pass 2 ad copy generation attempt ${attempt + 1} failed for ad group ${idx + 1} (${group.name})`, aiErrorMetadata(error))
          }
        }

        // Mixed-content quality checks: filler phrases, duplicate stems, angle coverage
        const headlineTexts = headlines.map((h: string) => h.toLowerCase().trim())
        const foundFillers = headlineTexts.filter((h: string) => BANNED_FILLER_PHRASES.some(f => h.includes(f)))
        if (foundFillers.length > 0) {
          pass2FailedGroup = `${group.name}: filler phrase detected`
        }
        const stemCounts: Record<string, number> = {}
        headlineTexts.forEach((h: string) => {
          const stem = h.replace(/[^\w\s]/g, "").split(" ")[0] || ""
          if (stem) stemCounts[stem] = (stemCounts[stem] || 0) + 1
        })
        const duplicateStems = Object.entries(stemCounts).filter(([, c]) => c > 1).length
        if (duplicateStems > 2 && !pass2FailedGroup) {
          pass2FailedGroup = `${group.name}: too many duplicate headline stems`
        }

        if (headlines.length < 8 || descriptions.length < 3) {
          pass2FailedGroup = group.name || `Ad Group ${idx + 1}`
        }

        // Weighted quality score check — fail if total < 70
        if (!pass2FailedGroup) {
          const qscore = scoreCreativeQuality(headlines, descriptions, input.offer, input.targetCustomer)
          if (!qscore.passed) {
            log("info", "ai/campaign-builder", `Ad group ${group.name} creative quality score: ${qscore.total}/100 (${qscore.dimensions.angleCoverage.reason})`)
            pass2FailedGroup = `${group.name}: quality score ${qscore.total}/100 — needs more angle coverage, specificity, or offer presence`
          }
        }

        return {
          ...group,
          headlines,
          descriptions,
        }
      })
    )

    if (pass2FailedGroup) {
      return NextResponse.json({
        ok: false,
        error: {
          code: "CREATIVE_GENERATION_FAILED",
          message: `AI could not produce high-converting direct-response copy for "${pass2FailedGroup}". Please add more specific offer details and retry.`,
        },
      }, { status: 502 })
    }


    // Assemble complete Google Plan
    const candidateRaw = {
      ...shellRaw,
      platform: "GOOGLE",
      campaignType: "SEARCH",
      dailyBudget: input.budget,
      finalUrl: input.landingPageUrl || shellRaw?.finalUrl || undefined,
      locations: shellRaw?.locations || [input.location],
      adGroups: adGroupsWithCreatives,
    }

    const validatedResult = parseGoogleSearchPlan(candidateRaw)
    if (!validatedResult.plan) {
      return NextResponse.json({ ok: false, error: { code: "PLAN_QUALITY_FAILED", message: String(validatedResult.error || "The generated plan did not meet Growzzy's safety and quality checks.") } }, { status: 422 })
    }
    quality = validatedResult.quality
    plan = { ...validatedResult.plan, qualityCheck: quality }
  }

  if (!plan) {
    return NextResponse.json({ ok: false, error: { code: "PLAN_QUALITY_FAILED", message: "The generated plan did not meet Growzzy's safety and quality checks." } }, { status: 422 })
  }

  if (input.platform === "GOOGLE") {
    const policyCheck = await checkPlanPolicy((plan as any).adGroups.map((group: any) => ({
      name: group.name,
      headlines: group.headlines,
      descriptions: group.descriptions,
    })))
    Object.assign(plan, { policyCheck, policyAcknowledged: policyCheck.status === "PASS" })
  }

  // Append landing page sentiment warning to plan risks if discouraging
  if (landingPageSentiment && landingPageSentiment.tone === "discouraging") {
    const lpRisk = `Landing page sentiment is discouraging (score: ${landingPageSentiment.score}). Concerns: ${(landingPageSentiment.concerns || []).join("; ") || "see landingPageSentiment summary"}.`
    if (Array.isArray((plan as any).risks)) {
      ;(plan as any).risks.unshift(lpRisk)
    }
  }

  const campaignPlan = await prisma.campaignPlan.create({
    data: {
      userId,
      workspaceId,
      adAccountId,
      adAccountExternalId: adAccount?.externalId ?? null,
      platform: input.platform,
      plan,
      briefInput: {
        platform: input.platform,
        offer: input.offer,
        targetCustomer: input.targetCustomer,
        budget: input.budget,
        location: input.location,
        goal: input.goal,
        landingPageUrl: input.landingPageUrl || undefined,
        imageUrl: input.imageUrl || undefined,
        metaObjective: input.metaObjective,
        enhancedBrief: input.enhancedBrief,
        clarifications: input.clarifications,
        ...(input.platform === "GOOGLE" ? { qualityCheck: quality } : {}),
      },
      status: "DRAFT",
    },
  })

  await recordActivity({
    userId,
    workspaceId,
    adAccountId,
    type: "CAMPAIGN_PLAN_CREATED",
    title: plan.campaignName,
    entityType: "CampaignPlan",
    entityId: campaignPlan.id,
    metadata: { score: plan.launchReadinessScore, platform: input.platform, campaignType: (plan as any).campaignType },
  })

  return NextResponse.json({
    ok: true,
    campaignPlanId: campaignPlan.id,
    plan,
    psychologyProfile,
    landingPageSentiment
  })
}

