import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import {
  createGoogleAdGroup,
  createGoogleAdsCampaign,
  createGoogleKeywords,
  createGoogleResponsiveSearchAd,
  updateGoogleCampaignStatus,
} from "@/lib/platform-actions"
import { getIntegrationAccessToken } from "@/lib/integration-tokens"
import { recordActivity } from "@/lib/activity-log"
import { log } from "@/lib/logger"

export type LaunchResult = {
  ok: boolean
  campaignId?: string
  externalCampaignId?: string
  adGroupsPublished?: number
  error?: string
  code?: string
}

type ValidatedAdGroup = {
  name: string
  theme: string
  keywords: Array<{ text: string; matchType: "BROAD" | "PHRASE" | "EXACT" }>
  negativeKeywords: string[]
  headlines: string[]
  descriptions: string[]
  finalUrl: string
}

type ValidatedPlan = {
  campaignName: string
  dailyBudget: number
  biddingStrategy: "MAXIMIZE_CONVERSIONS" | "MAXIMIZE_CLICKS" | "TARGET_CPA"
  targetCpa: number | null
  adGroups: ValidatedAdGroup[]
}

export function validatePlanForLaunch(plan: any, fallbackFinalUrl?: string | null): { plan?: ValidatedPlan; error?: string } {
  const campaignName = String(plan?.campaignName || "").trim()
  if (!campaignName) return { error: "Plan is missing a campaign name" }
  const dailyBudget = Number(plan?.dailyBudget)
  if (!Number.isFinite(dailyBudget) || dailyBudget <= 0) return { error: "Plan is missing a valid daily budget" }
  const biddingStrategy = ["MAXIMIZE_CONVERSIONS", "MAXIMIZE_CLICKS", "TARGET_CPA"].includes(String(plan?.biddingStrategy))
    ? (String(plan.biddingStrategy) as ValidatedPlan["biddingStrategy"])
    : "MAXIMIZE_CONVERSIONS"
  const targetCpa = biddingStrategy === "TARGET_CPA" ? Number(plan?.targetCpa) || null : null
  if (biddingStrategy === "TARGET_CPA" && !targetCpa) return { error: "TARGET_CPA bidding requires a target CPA value" }

  const planFinalUrl = String(plan?.finalUrl || fallbackFinalUrl || "").trim()
  const rawGroups = Array.isArray(plan?.adGroups) ? plan.adGroups : []
  if (rawGroups.length === 0) return { error: "Plan has no ad groups" }

  const adGroups: ValidatedAdGroup[] = []
  for (const group of rawGroups) {
    const name = String(group?.name || "").trim()
    if (!name) return { error: "An ad group is missing a name" }
    const finalUrl = String(group?.finalUrl || planFinalUrl).trim()
    if (!/^https?:\/\//.test(finalUrl)) return { error: `Ad group "${name}" has no final URL — add your landing page URL` }
    const keywords = (Array.isArray(group?.keywords) ? group.keywords : [])
      .map((k: any) => ({
        text: String(k?.text || k || "").trim().slice(0, 80),
        matchType: (["BROAD", "PHRASE", "EXACT"].includes(String(k?.matchType)) ? String(k.matchType) : "PHRASE") as "BROAD" | "PHRASE" | "EXACT",
      }))
      .filter((k: any) => k.text)
    if (keywords.length === 0) return { error: `Ad group "${name}" has no keywords` }
    const negativeKeywords = (Array.isArray(group?.negativeKeywords) ? group.negativeKeywords : [])
      .map((k: any) => String(k?.text || k || "").trim().slice(0, 80))
      .filter(Boolean)
    const headlines = (Array.isArray(group?.headlines) ? group.headlines : [])
      .map((h: any) => String(h?.text || h || "").trim().slice(0, 30))
      .filter(Boolean)
    if (headlines.length < 3) return { error: `Ad group "${name}" needs at least 3 headlines (30 chars max each)` }
    const descriptions = (Array.isArray(group?.descriptions) ? group.descriptions : [])
      .map((d: any) => String(d?.text || d || "").trim().slice(0, 90))
      .filter(Boolean)
    if (descriptions.length < 2) return { error: `Ad group "${name}" needs at least 2 descriptions (90 chars max each)` }
    adGroups.push({ name, theme: String(group?.theme || ""), keywords, negativeKeywords, headlines, descriptions, finalUrl })
  }

  return { plan: { campaignName, dailyBudget, biddingStrategy, targetCpa, adGroups } }
}

export function planFingerprint(planRowId: string, plan: ValidatedPlan): string {
  return crypto.createHash("sha256").update(planRowId + JSON.stringify(plan)).digest("hex").slice(0, 40)
}

export async function launchPlanToGoogle(params: {
  planRowId: string
  userId: string
  workspaceId: string
}): Promise<LaunchResult> {
  const { planRowId, userId, workspaceId } = params

  const planRow = await prisma.campaignPlan.findFirst({
    where: { id: planRowId, userId, workspaceId },
    include: { adAccount: { select: { managerCustomerId: true } } },
  })
  if (!planRow) return { ok: false, error: "Campaign plan not found", code: "NOT_FOUND" }
  if (planRow.status === "LIVE") {
    return { ok: false, error: "This plan has already been launched", code: "ALREADY_LIVE" }
  }
  if (planRow.status === "PUBLISHING") {
    return { ok: false, error: "This plan is already publishing — wait for it to finish", code: "PUBLISH_IN_PROGRESS" }
  }

  const validated = validatePlanForLaunch(planRow.plan)
  if (validated.error || !validated.plan) return { ok: false, error: validated.error, code: "VALIDATION_FAILED" }
  const plan = validated.plan

  // Idempotency: same plan content already published → return existing result
  const fingerprint = planFingerprint(planRow.id, plan)
  if (planRow.publishFingerprint === fingerprint && planRow.externalCampaignId) {
    return {
      ok: true,
      campaignId: planRow.launchedCampaignId || undefined,
      externalCampaignId: planRow.externalCampaignId,
      adGroupsPublished: plan.adGroups.length,
    }
  }

  // Hard policy block
  const policyCheck = (planRow.plan as any)?.policyCheck
  if (policyCheck?.status === "FAIL") {
    return { ok: false, error: "This plan contains prohibited content and cannot be launched", code: "POLICY_BLOCK" }
  }

  // Workspace budget ceiling — enforced server-side, never UI-only
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { dailyBudgetCeiling: true },
  })
  if (workspace?.dailyBudgetCeiling != null) {
    const activeBudget = await prisma.campaign.aggregate({
      where: { workspaceId, isLive: true },
      _sum: { budgetAmount: true },
    })
    if (Number(activeBudget._sum.budgetAmount || 0) + plan.dailyBudget > workspace.dailyBudgetCeiling) {
      return {
        ok: false,
        error: `Launching this would exceed your workspace daily budget ceiling of $${workspace.dailyBudgetCeiling}`,
        code: "BUDGET_CEILING",
      }
    }
  }

  const integration = await prisma.integration.findFirst({
    where: { userId, workspaceId, platform: "GOOGLE", status: "ACTIVE", hasAdsAccess: true },
  })
  const accessToken = integration ? getIntegrationAccessToken(integration) : null
  if (!integration || !accessToken) {
    return { ok: false, error: "Reconnect Google Ads before launching", code: "AUTH_REQUIRED" }
  }
  const customerId = planRow.adAccountExternalId || integration.selectedAdAccountId || integration.accountId || ""
  if (!customerId) return { ok: false, error: "No Google Ads account selected", code: "PREFLIGHT_BLOCK" }
  const loginCustomerId = planRow.adAccount?.managerCustomerId || customerId

  await prisma.campaignPlan.update({ where: { id: planRow.id }, data: { status: "PUBLISHING" } })

  let externalCampaignId: string | null = null
  let localCampaignId: string | null = null

  try {
    const campaignResult = await createGoogleAdsCampaign({
      accessToken,
      customerId,
      name: plan.campaignName,
      dailyBudgetMicros: Math.round(plan.dailyBudget * 1_000_000),
      objective: "SEARCH",
      biddingStrategy: plan.biddingStrategy,
      targetCpaMicros: plan.targetCpa ? Math.round(plan.targetCpa * 1_000_000) : null,
      status: "PAUSED",
      loginCustomerId,
    })
    externalCampaignId = campaignResult.campaignId

    const localCampaign = await prisma.campaign.create({
      data: {
        workspaceId,
        integrationId: integration.id,
        userId,
        platform: "GOOGLE",
        externalId: campaignResult.campaignId,
        adAccountId: planRow.adAccountId,
        adAccountExternalId: customerId,
        name: plan.campaignName,
        status: "PAUSED",
        objective: "SEARCH",
        type: "SEARCH",
        biddingStrategy: plan.biddingStrategy,
        targetCpa: plan.targetCpa,
        budgetAmount: plan.dailyBudget,
        dailyBudget: plan.dailyBudget,
        externalBudgetId: campaignResult.budgetResourceName || null,
        isLive: true,
        liveStatus: "LIVE_PAUSED",
        verifiedAt: new Date(),
        syncedAt: new Date(),
        hasCreative: true,
        rawData: { source: "AI_PLAN_LAUNCH", campaignPlanId: planRow.id },
      },
    })
    localCampaignId = localCampaign.id

    for (const group of plan.adGroups) {
      const adGroupResult = await createGoogleAdGroup({
        accessToken,
        customerId,
        campaignId: campaignResult.campaignId,
        name: group.name,
        defaultBidMicros: null,
        loginCustomerId,
      })

      const keywordPayload = [
        ...group.keywords.map((k) => ({ text: k.text, matchType: k.matchType, isNegative: false })),
        ...group.negativeKeywords.map((text) => ({ text, matchType: "BROAD" as const, isNegative: true })),
      ]
      await createGoogleKeywords({
        accessToken,
        customerId,
        adGroupId: adGroupResult.resourceName || adGroupResult.adGroupId,
        keywords: keywordPayload,
        loginCustomerId,
      })

      const adResult = await createGoogleResponsiveSearchAd({
        accessToken,
        customerId,
        adGroupId: adGroupResult.resourceName || adGroupResult.adGroupId,
        headlines: group.headlines.map((text) => ({ text })),
        descriptions: group.descriptions.map((text) => ({ text })),
        finalUrl: group.finalUrl,
        displayPath1: null,
        displayPath2: null,
        loginCustomerId,
      })

      const localAdGroup = await prisma.adGroup.create({
        data: {
          userId,
          campaignId: localCampaign.id,
          externalId: adGroupResult.adGroupId,
          name: group.name,
          theme: group.theme || null,
          isLive: true,
        },
      })
      await prisma.keyword.createMany({
        data: keywordPayload.map((k) => ({
          userId,
          adGroupId: localAdGroup.id,
          text: k.text,
          matchType: k.matchType,
          isNegative: k.isNegative,
        })),
      })
      await prisma.ad.create({
        data: {
          userId,
          adGroupId: localAdGroup.id,
          externalId: adResult.adId,
          resourceName: adResult.resourceName,
          headlines: group.headlines.map((text) => ({ text })),
          descriptions: group.descriptions.map((text) => ({ text })),
          finalUrl: group.finalUrl,
          adStrength: group.headlines.length >= 8 && group.descriptions.length >= 3 ? "GOOD" : "AVERAGE",
          isLive: true,
        },
      })
    }

    await prisma.campaignPlan.update({
      where: { id: planRow.id },
      data: {
        status: "LIVE",
        launchedCampaignId: localCampaign.id,
        externalCampaignId: campaignResult.campaignId,
        publishFingerprint: fingerprint,
        publishedAt: new Date(),
      },
    })

    await recordActivity({
      userId,
      workspaceId,
      adAccountId: planRow.adAccountId || customerId,
      type: "AI_PLAN_LAUNCHED",
      title: `${plan.campaignName} launched paused from AI plan`,
      entityType: "Campaign",
      entityId: localCampaign.id,
      metadata: { campaignPlanId: planRow.id, externalCampaignId: campaignResult.campaignId, adGroups: plan.adGroups.length },
    })

    return {
      ok: true,
      campaignId: localCampaign.id,
      externalCampaignId: campaignResult.campaignId,
      adGroupsPublished: plan.adGroups.length,
    }
  } catch (error: any) {
    const message = error?.message || "Google Ads launch failed"
    log("error", "services/google-publish", "Plan launch failed", { planRowId, message })

    // Roll back the remote campaign so no orphaned spend surface exists
    if (externalCampaignId) {
      try {
        await updateGoogleCampaignStatus({
          accessToken,
          customerId,
          campaignId: externalCampaignId,
          status: "REMOVED",
          loginCustomerId,
        })
      } catch (rollbackError: any) {
        log("error", "services/google-publish", "Rollback failed — manual cleanup needed", {
          externalCampaignId,
          message: rollbackError?.message,
        })
      }
    }
    if (localCampaignId) {
      await prisma.campaign.delete({ where: { id: localCampaignId } }).catch(() => undefined)
    }
    await prisma.campaignPlan.update({
      where: { id: planRow.id },
      data: { status: "FAILED", plan: { ...(planRow.plan as any), lastLaunchError: message } },
    }).catch(() => undefined)

    return { ok: false, error: message, code: "PROVIDER_ERROR" }
  }
}
