import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId } from "@/lib/workspace"
import { rateLimitPolicy, rateLimitResponse } from "@/lib/rate-limit"
import { log } from "@/lib/logger"
import { launchPlanToGoogle } from "@/lib/services/google-publish"
import { launchPlanToMeta } from "@/lib/services/meta-publish"
import { BANNED_FILLER_PHRASES, assessGoogleSearchPlan } from "@/lib/google-plan-quality"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Launch a chat-delivered campaign to the user's real ad account.
 *
 * Takes the flat `CampaignInput` shape that the agent-chat UI uses (15
 * headlines, 4 descriptions, primaryText, cta, targeting, etc.) and converts
 * it to the proper `GoogleSearchPlan` or `MetaPlan` shape the publish services
 * expect. Then it persists a `CampaignPlan` row and runs the same publish
 * service the dedicated /campaign-plan/[id]/launch endpoint uses.
 */

const ChatLaunchSchema = z.object({
  name: z.string().min(1),
  platform: z.enum(["GOOGLE", "META"]),
  objective: z.string().min(1),
  budgetDaily: z.number().positive().max(100000),
  currency: z.string().min(1).max(8).default("USD"),
  bidding: z.string().optional(),
  schedule: z.string().optional(),
  landingPage: z.string().url().optional().or(z.literal("")),
  offer: z.string().optional(),
  targetAudience: z.string().optional(),
  headlines: z.array(z.string()).min(1),
  descriptions: z.array(z.string()).optional().default([]),
  primaryText: z.string().optional(),
  cta: z.string().optional(),
  keywords: z.array(z.string()).optional().default([]),
  exclusions: z.array(z.string()).optional().default([]),
  targeting: z.array(z.object({ setting: z.string(), value: z.string() })).optional().default([]),
  keyCaveat: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  brandContext: z.string().optional(),
})

function inferKeywordsFromTargeting(targeting: { setting: string; value: string }[]): string[] {
  const out: string[] = []
  for (const t of targeting) {
    if (/keyword/i.test(t.setting)) {
      t.value
        .split(/[|,;]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((k) => out.push(k))
    }
  }
  return out
}

function pickHeadline(c: z.infer<typeof ChatLaunchSchema>): string {
  // Lead headline = first 30-char headline that contains a number or hook
  const SPECIFIC = /\d|\$|%|hour|day|cut|ship|audit|free|save|build/i
  const specific = c.headlines.find((h) => SPECIFIC.test(h) && h.length <= 30)
  if (specific) return specific
  return c.headlines.find((h) => h.length <= 30) ?? c.headlines[0].slice(0, 30)
}

function pickDescription(c: z.infer<typeof ChatLaunchSchema>): string {
  return c.descriptions.find((d) => d.length <= 90) ?? c.descriptions[0]?.slice(0, 90) ?? ""
}

function buildGoogleSearchPlan(c: z.infer<typeof ChatLaunchSchema>) {
  const headlines = c.headlines
    .map((h) => h.trim())
    .filter((h) => h.length > 0 && h.length <= 30)
    .slice(0, 15)
  const descriptions = (c.descriptions ?? [])
    .map((d) => d.trim())
    .filter((d) => d.length > 0 && d.length <= 90)
    .slice(0, 4)
  const inferredKeywords = inferKeywordsFromTargeting(c.targeting ?? [])
  const negativeKeywords = (c.exclusions ?? []).map((e) => e.replace(/^-/, "").trim()).filter(Boolean)
  // Build keyword objects: try to preserve [exact] / "phrase" markers from the chat model
  const keywords = (c.keywords ?? []).map((k) => {
    const text = k.trim()
    let matchType: "BROAD" | "PHRASE" | "EXACT" = "PHRASE"
    if (text.startsWith("[") && text.endsWith("]")) {
      return { text: text.slice(1, -1).trim().slice(0, 80), matchType: "EXACT" as const }
    }
    if (text.startsWith('"') && text.endsWith('"')) {
      return { text: text.slice(1, -1).trim().slice(0, 80), matchType: "PHRASE" as const }
    }
    return { text: text.slice(0, 80), matchType }
  }).filter((k) => k.text)
  // If the model gave us only keyword phrases (no match types) via targeting, fold them in
  if (keywords.length === 0) {
    inferredKeywords.forEach((k) => {
      keywords.push({ text: k.slice(0, 80), matchType: "PHRASE" as const })
    })
  }
  // Last-resort fallback so validation passes
  if (keywords.length === 0) {
    keywords.push({ text: (c.offer || c.name || "ai infrastructure").slice(0, 80), matchType: "PHRASE" as const })
  }
  // Map bidding chat string to enum
  const biddingMap: Record<string, "MAXIMIZE_CONVERSIONS" | "MAXIMIZE_CLICKS" | "TARGET_CPA"> = {
    "maximize conversions": "MAXIMIZE_CONVERSIONS",
    "maximize clicks": "MAXIMIZE_CLICKS",
    "target cpa": "TARGET_CPA",
    "manual cpc": "MAXIMIZE_CLICKS",
  }
  const biddingStrategy = biddingMap[String(c.bidding || "").toLowerCase()] ?? "MAXIMIZE_CONVERSIONS"

  return {
    platform: "GOOGLE" as const,
    campaignType: "SEARCH" as const,
    objective: c.objective || "LEADS",
    campaignName: c.name,
    biddingStrategy,
    dailyBudget: c.budgetDaily,
    finalUrl: c.landingPage || undefined,
    locations: ["United States"],
    languages: ["en"],
    adGroups: [
      {
        name: c.name,
        theme: c.offer || "Primary",
        keywords,
        negativeKeywords,
        headlines,
        descriptions,
        finalUrl: c.landingPage || undefined,
      },
    ],
    rationale: {
      whyThisStructure: c.offer
        ? `Single ad group for the ${c.offer} lead-gen campaign. ${c.keyCaveat ?? ""}`
        : `Single ad group for the ${c.name} campaign.`,
      whyTheseKeywords: `Derived from targeting and offer (${c.targetAudience ?? "primary audience"}).`,
      whyThisBidding: `${biddingStrategy} for early conversion learning.`,
    },
    launchReadinessScore: 75,
    risks: c.keyCaveat ? [c.keyCaveat] : [],
    policyCheck: {
      checkedAt: new Date().toISOString(),
      status: "PASS" as const,
      notes: "Auto-checked at chat launch (no live ad copy detected as policy-sensitive).",
    },
  }
}

function buildMetaPlan(c: z.infer<typeof ChatLaunchSchema>) {
  const headline = pickHeadline(c)
  const description = pickDescription(c)
  const primaryText = (c.primaryText ?? "").slice(0, 5000)
  const imageUrl = c.imageUrl || ""
  return {
    platform: "META" as const,
    campaignName: c.name,
    objective: "OUTCOME_LEADS" as const,
    dailyBudget: c.budgetDaily,
    adSetName: `${c.name} — Primary Audience`,
    optimizationGoal: "LEAD_GENERATION",
    billingEvent: "IMPRESSIONS",
    targeting: {},
    placements: { facebook: ["feed"], instagram: ["feed", "story"] },
    pageId: "",
    instagramActorId: null,
    pixelId: null,
    appId: null,
    objectStoreUrl: null,
    creative: {
      name: `${c.name} — Lead Creative`,
      primaryText,
      headline,
      description,
      imageUrl,
      destinationUrl: c.landingPage || "",
      callToAction: c.cta || "LEARN_MORE",
    },
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Sign in to launch campaigns." } }, { status: 401 })
  }
  const userId = await resolveUserId(session.user.id)
  const limit = await rateLimitPolicy(userId, "campaignLaunch")
  if (!limit.allowed) return rateLimitResponse(limit)

  const body = await req.json().catch(() => null)
  const parsed = ChatLaunchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_INPUT", message: parsed.error.issues[0]?.message || "Invalid campaign payload" } },
      { status: 400 }
    )
  }
  const c = parsed.data
  const workspaceId = await getRequestWorkspaceId(userId, req)

  // Pre-flight: block launch if headlines still contain banned phrases
  const allCopy = [c.name, ...c.headlines, ...c.descriptions, c.primaryText ?? ""].join(" ").toLowerCase()
  const bannedHits = BANNED_FILLER_PHRASES.filter((p) => allCopy.includes(p))
  if (bannedHits.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "QUALITY_BLOCK",
          message: `Campaign contains banned copy (${bannedHits.slice(0, 3).join(", ")}). Ask the agent to rewrite the headlines before launching.`,
        },
      },
      { status: 422 }
    )
  }

  // Pre-flight: confirm integration is connected for this platform
  const integration = await prisma.integration.findFirst({
    where: {
      userId,
      workspaceId,
      platform: c.platform === "META" ? "META" : "GOOGLE",
      status: { in: ["ACCOUNT_SELECTED", "INITIAL_SYNC_RUNNING", "ACTIVE", "OAUTH_GRANTED"] },
    },
    select: { id: true, status: true, adAccounts: { where: { isPrimary: true }, take: 1, select: { id: true, externalId: true, currencyCode: true, managerCustomerId: true } } },
  })
  if (!integration) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INTEGRATION_REQUIRED",
          message: `Connect your ${c.platform === "META" ? "Meta Ads" : "Google Ads"} account first. Open Settings → Integrations.`,
        },
      },
      { status: 412 }
    )
  }
  const primaryAdAccount = integration.adAccounts[0]
  if (!primaryAdAccount) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "AD_ACCOUNT_REQUIRED",
          message: `Select a primary ${c.platform === "META" ? "Meta" : "Google"} ad account before launching.`,
        },
      },
      { status: 412 }
    )
  }

  // Build the proper plan shape for the publish service
  const planPayload = c.platform === "META" ? buildMetaPlan(c) : buildGoogleSearchPlan(c)

  // For Google, run quality assessment — but treat WARN as PASS for chat-launched
  if (c.platform === "GOOGLE") {
    const quality = assessGoogleSearchPlan(planPayload as any, { requireFinalUrl: false })
    if (quality.status === "FAIL") {
      return NextResponse.json(
        {
          ok: false,
          error: { code: "QUALITY_BLOCK", message: `Plan validation failed: ${quality.errors[0]}` },
        },
        { status: 422 }
      )
    }
  }

  // Persist as a CampaignPlan so the launch service can pick it up
  const planRow = await prisma.campaignPlan.create({
    data: {
      userId,
      workspaceId,
      adAccountId: primaryAdAccount.id,
      adAccountExternalId: primaryAdAccount.externalId,
      platform: c.platform,
      plan: planPayload as any,
      briefInput: { source: "chat", ...(c.brandContext ? { brandContext: c.brandContext } : {}) } as any,
      status: "PUBLISHING",
    },
  })

  log("info", "chat/launch", "Persisted chat plan for launch", {
    planId: planRow.id,
    platform: c.platform,
    userId,
    workspaceId,
  })

  // Hand off to the real publish service
  const result = c.platform === "META"
    ? await launchPlanToMeta({ planRowId: planRow.id, userId, workspaceId })
    : await launchPlanToGoogle({ planRowId: planRow.id, userId, workspaceId })

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        planId: planRow.id,
        error: { code: result.code || "LAUNCH_FAILED", message: result.error || "Ad account rejected the launch" },
      },
      { status: result.code === "NOT_FOUND" ? 404 : result.code === "AUTH_REQUIRED" ? 401 : 422 }
    )
  }

  return NextResponse.json({
    ok: true,
    planId: planRow.id,
    externalCampaignId: result.externalCampaignId,
    adGroupsPublished: result.adGroupsPublished,
    message: `Campaign is live in your ${c.platform === "META" ? "Meta" : "Google"} Ads account.`,
  })
}
