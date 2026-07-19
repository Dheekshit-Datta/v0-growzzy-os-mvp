import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId } from "@/lib/workspace"
import { recordActivity } from "@/lib/activity-log"
import { accountIdVariants, normalizeAccountId } from "@/lib/account-id"
import { getBusinessContextForWorkspace } from "@/lib/business-context"
import { rateLimitPolicy, rateLimitResponse } from "@/lib/rate-limit"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" })

const CampaignBuilderSchema = z.object({
  platform: z.enum(["GOOGLE", "META"]).default("GOOGLE"),
  workspaceId: z.string().optional(),
  adAccountId: z.string().optional(),
  offer: z.string().min(3, "Tell us what you sell"),
  landingPageUrl: z.string().url().optional().or(z.literal("")),
  targetCustomer: z.string().min(3, "Add a target customer"),
  budget: z.coerce.number().positive("Budget must be greater than 0"),
  location: z.string().min(2, "Add a target location"),
  goal: z.string().min(2, "Select a goal"),
  imageUrl: z.string().url().optional().or(z.literal("")),
  metaObjective: z.enum(["AWARENESS", "TRAFFIC", "ENGAGEMENT", "LEADS", "SALES", "APP_PROMOTION"]).optional(),
  objectStoreUrl: z.string().url().optional().or(z.literal("")),
})

function validateGooglePlan(plan: any) {
  const adGroups = Array.isArray(plan?.adGroups) ? plan.adGroups : []
  return {
    platform: "GOOGLE",
    campaignType: "SEARCH",
    objective: String(plan?.objective || "CONVERSIONS"),
    campaignName: String(plan?.campaignName || "AI Google Search Campaign").slice(0, 120),
    biddingStrategy: ["MAXIMIZE_CONVERSIONS", "MAXIMIZE_CLICKS", "TARGET_CPA", "TARGET_ROAS"].includes(String(plan?.biddingStrategy))
      ? String(plan.biddingStrategy)
      : "MAXIMIZE_CONVERSIONS",
    targetCpa: plan?.targetCpa ? Number(plan.targetCpa) : null,
    targetRoas: plan?.targetRoas ? Number(plan.targetRoas) : null,
    dailyBudget: Number(plan?.dailyBudget || 0),
    locations: Array.isArray(plan?.locations) ? plan.locations : [],
    languages: Array.isArray(plan?.languages) ? plan.languages : ["English"],
    landingPageSuggestions: Array.isArray(plan?.landingPageSuggestions) ? plan.landingPageSuggestions.slice(0, 5) : [],
    launchReadinessScore: Math.max(0, Math.min(100, Number(plan?.launchReadinessScore || 70))),
    risks: Array.isArray(plan?.risks) ? plan.risks.slice(0, 5) : [],
    finalUrl: typeof plan?.finalUrl === "string" && /^https?:\/\//.test(plan.finalUrl) ? plan.finalUrl : undefined,
    rationale: {
      whyThisStructure: String(plan?.rationale?.whyThisStructure || "").slice(0, 600),
      whyTheseKeywords: String(plan?.rationale?.whyTheseKeywords || "").slice(0, 600),
      whyThisBidding: String(plan?.rationale?.whyThisBidding || "").slice(0, 600),
      expectedResultsRange: String(plan?.rationale?.expectedResultsRange || "").slice(0, 300),
    },
    adGroups: adGroups.slice(0, 6).map((group: any) => ({
      name: String(group?.name || "Core Ad Group").slice(0, 80),
      theme: String(group?.theme || ""),
      keywords: (Array.isArray(group?.keywords) ? group.keywords : []).slice(0, 20).map((keyword: any) => ({
        text: String(keyword?.text || keyword || "").slice(0, 80),
        matchType: ["BROAD", "PHRASE", "EXACT"].includes(String(keyword?.matchType)) ? String(keyword.matchType) : "PHRASE",
        intent: String(keyword?.intent || "high"),
      })),
      negativeKeywords: (Array.isArray(group?.negativeKeywords) ? group.negativeKeywords : [])
        .slice(0, 30)
        .map((keyword: any) => String(keyword?.text || keyword || "").slice(0, 80))
        .filter(Boolean),
      headlines: (Array.isArray(group?.headlines) ? group.headlines : []).slice(0, 15).map((headline: any) => String(headline?.text || headline || "").slice(0, 30)),
      descriptions: (Array.isArray(group?.descriptions) ? group.descriptions : []).slice(0, 4).map((description: any) => String(description?.text || description || "").slice(0, 90)),
    })),
  }
}

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
  const kind = input.metaObjective || (String(input.goal).toUpperCase() as keyof typeof META_OBJECTIVES)
  const objective = META_OBJECTIVES[kind] || META_OBJECTIVES.TRAFFIC
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
  const input = CampaignBuilderSchema.parse(await req.json())
  if (input.platform === "META" && process.env.ENABLE_META_ADS !== "true") {
    return NextResponse.json({ ok: false, error: { code: "META_DISABLED", message: "Meta Ads is not enabled yet." } }, { status: 404 })
  }
  const workspaceId = await getRequestWorkspaceId(userId, req)
  const integration = await prisma.integration.findFirst({
    where: {
      userId,
      workspaceId,
      platform: input.platform,
      status: { in: ["OAUTH_GRANTED", "ACCOUNT_SELECTED", "INITIAL_SYNC_RUNNING", "ACTIVE", "SYNC_FAILED"] },
    },
    select: { id: true, selectedAdAccountId: true, accountId: true, hasAdsAccess: true, accountInfo: true },
  })
  const selectedAdAccountId = integration?.selectedAdAccountId || integration?.accountId || null
  if (input.adAccountId && normalizeAccountId(input.adAccountId) !== normalizeAccountId(selectedAdAccountId)) {
    return NextResponse.json({ ok: false, error: { code: "ACCOUNT_SCOPE_MISMATCH", message: `The selected ${input.platform === "META" ? "Meta" : "Google"} Ads account is not active in this workspace.` } }, { status: 403 })
  }
  if (!selectedAdAccountId || !integration?.hasAdsAccess) {
    return NextResponse.json({ ok: false, error: { code: "NO_SELECTED_AD_ACCOUNT", message: `Connect ${input.platform === "META" ? "Meta" : "Google"} Ads and select an ad account before building a launchable campaign plan.` } }, { status: 409 })
  }
  const adAccount = await prisma.adAccount.findFirst({
    where: { integrationId: integration.id, externalId: { in: accountIdVariants(selectedAdAccountId) } },
    select: { id: true, externalId: true },
  })
  if (!adAccount) return NextResponse.json({ ok: false, error: { code: "NO_SELECTED_AD_ACCOUNT", message: "Selected ad account metadata is missing." } }, { status: 409 })
  const adAccountId = adAccount.id
  const businessContext = await getBusinessContextForWorkspace(workspaceId)

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ ok: false, error: "AI Campaign Builder is unavailable because OPENAI_API_KEY is not configured." }, { status: 503 })
  }

  const googlePrompt = `You are a senior Google Ads media buyer. Build a safe, reviewable Google Ads campaign plan.

Business offer: ${input.offer}
Landing page: ${input.landingPageUrl || "Not provided"}
Target customer: ${input.targetCustomer}
Budget: $${input.budget}/day
Location: ${input.location}
Goal: ${input.goal}
${businessContext}

Create 2-3 tightly themed ad groups. Each needs 10-20 keywords, at least 5 negative keywords, 8-15 headlines, and 3-4 descriptions.

Bidding strategy: this is a brand-new campaign with zero conversion history in this Google Ads account. Choose MAXIMIZE_CONVERSIONS, MAXIMIZE_CLICKS, or TARGET_CPA. Do NOT choose TARGET_ROAS here - Target ROAS bidding requires an established history of accurate conversion value data to perform well, which a day-one campaign never has; recommending it now would set the account up to underperform.

Return ONLY JSON:
{
  "campaignName": "clear Google campaign name",
  "campaignType": "SEARCH",
  "objective": "LEADS|SALES|TRAFFIC|AWARENESS",
  "biddingStrategy": "MAXIMIZE_CONVERSIONS|MAXIMIZE_CLICKS|TARGET_CPA",
  "targetCpa": "number or null - only if biddingStrategy is TARGET_CPA",
  "dailyBudget": number,
  "finalUrl": "${input.landingPageUrl || "https://example.com"}",
  "locations": ["..."],
  "languages": ["English"],
  "adGroups": [
    {
      "name": "theme",
      "theme": "what this ad group targets",
      "keywords": [{"text":"10-20 keywords","matchType":"BROAD|PHRASE|EXACT","intent":"high|medium"}],
      "negativeKeywords": ["free", "jobs", "diy", "course", "definition"],
      "headlines": ["8-15 headlines, each <=30 chars"],
      "descriptions": ["3-4 descriptions, each <=90 chars"]
    }
  ],
  "rationale": {
    "whyThisStructure": "plain-English explanation",
    "whyTheseKeywords": "plain-English explanation",
    "whyThisBidding": "plain-English explanation",
    "expectedResultsRange": "honest estimate"
  },
  "landingPageSuggestions": ["specific improvements"],
  "launchReadinessScore": 0-100,
  "risks": ["specific launch risks"]
}`

  const metaPrompt = `You are a senior Meta Ads media buyer. Build one safe, reviewable Meta campaign draft.

Offer: ${input.offer}
Destination: ${input.landingPageUrl || "Not provided"}
Audience: ${input.targetCustomer}
Budget: $${input.budget}/day
Location: ${input.location}
Objective: ${input.metaObjective || input.goal}
${businessContext}

Return ONLY JSON with campaignName, adSetName, countryCode (ISO-2), targeting (Meta targeting object with geo_locations), placements (publisher_platforms and facebook_positions/instagram_positions when appropriate), creative { name, primaryText, headline, description, callToAction }, rationale, launchReadinessScore, and risks. Do not invent a Page, Pixel, app, destination URL, or image URL.`

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_CAMPAIGN_BUILDER_MODEL || "gpt-4o",
    temperature: 0.35,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: input.platform === "META" ? metaPrompt : googlePrompt }],
  })

  const raw = JSON.parse(completion.choices[0]?.message?.content || "{}")
  const plan = input.platform === "META"
    ? validateMetaPlan(raw, input, object(object(integration.accountInfo).metaAssets))
    : validateGooglePlan({
        ...raw,
        dailyBudget: input.budget,
        finalUrl: raw.finalUrl || input.landingPageUrl || undefined,
        locations: raw.locations || [input.location],
      })

  const campaignPlan = await prisma.campaignPlan.create({
    data: {
      userId,
      workspaceId,
      adAccountId,
      adAccountExternalId: adAccount.externalId,
      platform: input.platform,
      plan,
      briefInput: {
        offer: input.offer,
        targetCustomer: input.targetCustomer,
        budget: input.budget,
        location: input.location,
        goal: input.goal,
        landingPageUrl: input.landingPageUrl || undefined,
        imageUrl: input.imageUrl || undefined,
        metaObjective: input.metaObjective,
      },
      status: "DRAFT",
    },
  })

  await recordActivity({
    userId,
    workspaceId,
    adAccountId,
    type: "CAMPAIGN_PLAN_CREATED",
    title: "AI campaign plan created",
    message: plan.campaignName,
    entityType: "CampaignPlan",
    entityId: campaignPlan.id,
    metadata: { score: plan.launchReadinessScore, platform: input.platform, campaignType: (plan as any).campaignType },
  })

  return NextResponse.json({ ok: true, campaignPlanId: campaignPlan.id, plan })
}
