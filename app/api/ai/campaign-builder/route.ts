import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId } from "@/lib/workspace"
import { recordActivity } from "@/lib/activity-log"
import { accountIdVariants, normalizeAccountId } from "@/lib/account-id"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" })

const CampaignBuilderSchema = z.object({
  workspaceId: z.string().optional(),
  adAccountId: z.string().optional(),
  offer: z.string().min(3, "Tell us what you sell"),
  landingPageUrl: z.string().url().optional().or(z.literal("")),
  targetCustomer: z.string().min(3, "Add a target customer"),
  budget: z.coerce.number().positive("Budget must be greater than 0"),
  location: z.string().min(2, "Add a target location"),
  goal: z.string().min(2, "Select a goal"),
})

function validatePlan(plan: any) {
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

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = await resolveUserId(session.user.id)
  const input = CampaignBuilderSchema.parse(await req.json())
  const workspaceId = await getRequestWorkspaceId(userId, req)
  const integration = await prisma.integration.findFirst({
    where: {
      userId,
      workspaceId,
      platform: "GOOGLE",
      status: { in: ["OAUTH_GRANTED", "ACCOUNT_SELECTED", "INITIAL_SYNC_RUNNING", "ACTIVE", "SYNC_FAILED"] },
    },
    select: { id: true, selectedAdAccountId: true, accountId: true, hasAdsAccess: true },
  })
  const selectedAdAccountId = integration?.selectedAdAccountId || integration?.accountId || null
  if (input.adAccountId && normalizeAccountId(input.adAccountId) !== normalizeAccountId(selectedAdAccountId)) {
    return NextResponse.json({ ok: false, code: "ACCOUNT_SCOPE_MISMATCH", error: "The selected Google Ads account is not active in this workspace." }, { status: 403 })
  }
  if (!selectedAdAccountId || !integration?.hasAdsAccess) {
    return NextResponse.json({ ok: false, code: "NO_SELECTED_AD_ACCOUNT", error: "Connect Google Ads and select an ad account before building a launchable campaign plan." }, { status: 409 })
  }
  const adAccount = await prisma.adAccount.findFirst({
    where: { integrationId: integration.id, externalId: { in: accountIdVariants(selectedAdAccountId) } },
    select: { id: true, externalId: true },
  })
  if (!adAccount) return NextResponse.json({ ok: false, code: "NO_SELECTED_AD_ACCOUNT", error: "Selected Google Ads account metadata is missing." }, { status: 409 })
  const adAccountId = adAccount.id

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ ok: false, error: "AI Campaign Builder is unavailable because OPENAI_API_KEY is not configured." }, { status: 503 })
  }

  const prompt = `You are a senior Google Ads media buyer. Build a safe, reviewable Google Ads campaign plan.

Business offer: ${input.offer}
Landing page: ${input.landingPageUrl || "Not provided"}
Target customer: ${input.targetCustomer}
Budget: $${input.budget}/day
Location: ${input.location}
Goal: ${input.goal}

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

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_CAMPAIGN_BUILDER_MODEL || "gpt-4o",
    temperature: 0.35,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  })

  const raw = JSON.parse(completion.choices[0]?.message?.content || "{}")
  const plan = validatePlan({
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
      platform: "GOOGLE",
      plan,
      briefInput: {
        offer: input.offer,
        targetCustomer: input.targetCustomer,
        budget: input.budget,
        location: input.location,
        goal: input.goal,
        landingPageUrl: input.landingPageUrl || undefined,
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
    metadata: { score: plan.launchReadinessScore, campaignType: plan.campaignType },
  })

  return NextResponse.json({ ok: true, campaignPlanId: campaignPlan.id, plan })
}
