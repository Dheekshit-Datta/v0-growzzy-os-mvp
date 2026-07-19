import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import { getIntegrationAccessToken } from "@/lib/integration-tokens"
import { recordActivity } from "@/lib/activity-log"
import { log } from "@/lib/logger"
import { MetaAdsService } from "@/services/integrations/meta"
import type { LaunchResult } from "@/lib/services/google-publish"

const OBJECTIVES = ["OUTCOME_AWARENESS", "OUTCOME_TRAFFIC", "OUTCOME_ENGAGEMENT", "OUTCOME_LEADS", "OUTCOME_SALES", "OUTCOME_APP_PROMOTION"] as const

type MetaPlan = {
  campaignName: string
  objective: typeof OBJECTIVES[number]
  dailyBudget: number
  adSetName: string
  optimizationGoal: string
  billingEvent: string
  targeting: Record<string, unknown>
  placements: Record<string, unknown>
  pageId: string
  instagramActorId: string | null
  pixelId: string | null
  appId: string | null
  objectStoreUrl: string | null
  creative: {
    name: string
    primaryText: string
    headline: string
    description: string
    imageUrl: string
    destinationUrl: string
    callToAction: string
  }
}

function object(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {}
}

export function currencyMinorAmount(amount: number, currencyCode = "USD") {
  const digits = new Intl.NumberFormat("en", { style: "currency", currency: currencyCode }).resolvedOptions().maximumFractionDigits ?? 2
  return Math.round(amount * 10 ** digits)
}

export function validateMetaPlanForLaunch(raw: any): { plan?: MetaPlan; error?: string } {
  const campaignName = String(raw?.campaignName || "").trim()
  if (!campaignName) return { error: "Plan is missing a campaign name" }
  const objective = String(raw?.objective || "") as MetaPlan["objective"]
  if (!OBJECTIVES.includes(objective)) return { error: "Plan has an unsupported Meta objective" }
  const dailyBudget = Number(raw?.dailyBudget)
  if (!Number.isFinite(dailyBudget) || dailyBudget <= 0) return { error: "Plan is missing a valid daily budget" }
  const pageId = String(raw?.pageId || "").trim()
  if (!pageId) return { error: "Select a Facebook Page before launching" }
  const creative = object(raw?.creative)
  const imageUrl = String(creative.imageUrl || "").trim()
  if (!/^https:\/\//i.test(imageUrl)) return { error: "Add a public HTTPS image before launching" }
  const destinationUrl = String(creative.destinationUrl || "").trim()
  if (!/^https:\/\//i.test(destinationUrl)) return { error: "Add a public HTTPS destination URL before launching" }
  const pixelId = String(raw?.pixelId || "").trim() || null
  if (["OUTCOME_LEADS", "OUTCOME_SALES"].includes(objective) && !pixelId) {
    return { error: `${objective === "OUTCOME_LEADS" ? "Website leads" : "Sales"} requires a selected Meta Pixel/Dataset` }
  }
  const appId = String(raw?.appId || "").trim() || null
  const objectStoreUrl = String(raw?.objectStoreUrl || "").trim() || null
  if (objective === "OUTCOME_APP_PROMOTION" && (!appId || !objectStoreUrl)) {
    return { error: "App promotion requires a selected registered app and its App Store or Play Store URL" }
  }
  const targeting = object(raw?.targeting)
  if (!targeting.geo_locations) return { error: "Meta targeting requires at least one location" }

  if (object(raw)?.policyCheck?.status === "FAIL") return { error: "This plan contains prohibited content and cannot be launched" }

  return {
    plan: {
      campaignName: campaignName.slice(0, 120),
      objective,
      dailyBudget,
      adSetName: String(raw?.adSetName || `${campaignName} Ad Set`).slice(0, 120),
      optimizationGoal: String(raw?.optimizationGoal || "LINK_CLICKS"),
      billingEvent: String(raw?.billingEvent || "IMPRESSIONS"),
      targeting,
      placements: object(raw?.placements),
      pageId,
      instagramActorId: String(raw?.instagramActorId || "").trim() || null,
      pixelId,
      appId,
      objectStoreUrl,
      creative: {
        name: String(creative.name || `${campaignName} Ad`).slice(0, 120),
        primaryText: String(creative.primaryText || "").trim().slice(0, 2200),
        headline: String(creative.headline || "").trim().slice(0, 255),
        description: String(creative.description || "").trim().slice(0, 255),
        imageUrl,
        destinationUrl,
        callToAction: String(creative.callToAction || "LEARN_MORE"),
      },
    },
  }
}

function fingerprint(planRowId: string, plan: MetaPlan) {
  return crypto.createHash("sha256").update(planRowId + JSON.stringify(plan)).digest("hex").slice(0, 40)
}

function promotedObject(plan: MetaPlan) {
  if (plan.objective === "OUTCOME_LEADS") return { pixel_id: plan.pixelId, custom_event_type: "LEAD" }
  if (plan.objective === "OUTCOME_SALES") return { pixel_id: plan.pixelId, custom_event_type: "PURCHASE" }
  if (plan.objective === "OUTCOME_APP_PROMOTION") return { application_id: plan.appId, object_store_url: plan.objectStoreUrl }
  if (plan.objective === "OUTCOME_ENGAGEMENT") return { page_id: plan.pageId }
  return undefined
}

export async function launchPlanToMeta(params: { planRowId: string; userId: string; workspaceId: string }): Promise<LaunchResult> {
  if (!MetaAdsService.isEnabled()) return { ok: false, error: "Meta Ads is not enabled", code: "PREFLIGHT_BLOCK" }
  const planRow = await prisma.campaignPlan.findFirst({
    where: { id: params.planRowId, userId: params.userId, workspaceId: params.workspaceId },
    include: { adAccount: { select: { currencyCode: true } } },
  })
  if (!planRow) return { ok: false, error: "Campaign plan not found", code: "NOT_FOUND" }
  if (planRow.platform !== "META") return { ok: false, error: "Campaign plan platform mismatch", code: "VALIDATION_FAILED" }
  if (planRow.status === "LIVE") return { ok: false, error: "This plan has already been launched", code: "ALREADY_LIVE" }
  if (planRow.status === "PUBLISHING") return { ok: false, error: "This plan is already publishing", code: "PUBLISH_IN_PROGRESS" }
  const validated = validateMetaPlanForLaunch(planRow.plan)
  if (!validated.plan || validated.error) return { ok: false, error: validated.error, code: "VALIDATION_FAILED" }
  const plan = validated.plan
  const publishFingerprint = fingerprint(planRow.id, plan)
  if (planRow.publishFingerprint === publishFingerprint && planRow.externalCampaignId) {
    return { ok: true, campaignId: planRow.launchedCampaignId || undefined, externalCampaignId: planRow.externalCampaignId, adGroupsPublished: 1 }
  }

  const workspace = await prisma.workspace.findUnique({ where: { id: params.workspaceId }, select: { dailyBudgetCeiling: true } })
  const activeBudget = await prisma.campaign.aggregate({ where: { workspaceId: params.workspaceId, isLive: true }, _sum: { budgetAmount: true } })
  if (workspace?.dailyBudgetCeiling != null && Number(activeBudget._sum.budgetAmount || 0) + plan.dailyBudget > workspace.dailyBudgetCeiling) {
    return { ok: false, error: `Launching this would exceed your workspace daily budget ceiling of $${workspace.dailyBudgetCeiling}`, code: "BUDGET_CEILING" }
  }

  const integration = await prisma.integration.findFirst({
    where: { userId: params.userId, workspaceId: params.workspaceId, platform: "META", hasAdsAccess: true, status: "ACTIVE" },
  })
  const accessToken = integration ? getIntegrationAccessToken(integration) : null
  if (!integration || !accessToken) return { ok: false, error: "Reconnect Meta Ads before launching", code: "AUTH_REQUIRED" }
  const accountId = planRow.adAccountExternalId || integration.selectedAdAccountId || integration.accountId || ""
  if (!accountId) return { ok: false, error: "No Meta ad account selected", code: "PREFLIGHT_BLOCK" }
  const selectedAssets = object(object(integration.accountInfo).metaAssets)
  if (selectedAssets.pageId !== plan.pageId || (plan.pixelId && selectedAssets.pixelId !== plan.pixelId) || (plan.appId && selectedAssets.appId !== plan.appId)) {
    return { ok: false, error: "The plan references Meta assets that are not selected for this workspace", code: "PREFLIGHT_BLOCK" }
  }

  await prisma.campaignPlan.update({ where: { id: planRow.id }, data: { status: "PUBLISHING" } })
  const remoteIds: string[] = []
  let imageHash: string | null = null
  try {
    const campaign = await MetaAdsService.createCampaign(accessToken, accountId, { name: plan.campaignName, objective: plan.objective })
    remoteIds.push(campaign.id)
    const adSet = await MetaAdsService.createAdSet(accessToken, accountId, {
      name: plan.adSetName,
      campaignId: campaign.id,
      dailyBudgetMinor: currencyMinorAmount(plan.dailyBudget, planRow.adAccount?.currencyCode || "USD"),
      billingEvent: plan.billingEvent,
      optimizationGoal: plan.optimizationGoal,
      targeting: plan.targeting,
      placements: plan.placements,
      promotedObject: promotedObject(plan),
    })
    remoteIds.push(adSet.id)
    imageHash = await MetaAdsService.uploadAdImage(accessToken, accountId, plan.creative.imageUrl)
    const creative = await MetaAdsService.createAdCreative(accessToken, accountId, { ...plan.creative, pageId: plan.pageId, instagramActorId: plan.instagramActorId, imageHash })
    remoteIds.push(creative.id)
    const ad = await MetaAdsService.createAd(accessToken, accountId, { name: plan.creative.name, adSetId: adSet.id, creativeId: creative.id })
    remoteIds.push(ad.id)

    const localCampaign = await prisma.campaign.create({
      data: {
        workspaceId: params.workspaceId,
        integrationId: integration.id,
        userId: params.userId,
        platform: "META",
        externalId: campaign.id,
        adAccountId: planRow.adAccountId,
        adAccountExternalId: accountId,
        name: plan.campaignName,
        status: "PAUSED",
        objective: plan.objective,
        type: "META",
        budgetAmount: plan.dailyBudget,
        dailyBudget: plan.dailyBudget,
        isLive: true,
        liveStatus: "LIVE_PAUSED",
        verifiedAt: new Date(),
        syncedAt: new Date(),
        hasCreative: true,
        rawData: { source: "AI_PLAN_LAUNCH", campaignPlanId: planRow.id, meta: { adSetId: adSet.id, creativeId: creative.id, adId: ad.id } },
      },
    })
    const localAdGroup = await prisma.adGroup.create({ data: { userId: params.userId, campaignId: localCampaign.id, externalId: adSet.id, name: plan.adSetName, status: "PAUSED", isLive: true } })
    await prisma.ad.create({ data: { userId: params.userId, adGroupId: localAdGroup.id, externalId: ad.id, headlines: [{ text: plan.creative.headline }], descriptions: [{ text: plan.creative.primaryText }], finalUrl: plan.creative.destinationUrl, status: "PAUSED", isLive: true } })
    await prisma.campaignPlan.update({ where: { id: planRow.id }, data: { status: "LIVE", launchedCampaignId: localCampaign.id, externalCampaignId: campaign.id, publishFingerprint, publishedAt: new Date() } })
    await recordActivity({ userId: params.userId, workspaceId: params.workspaceId, adAccountId: planRow.adAccountId || accountId, type: "AI_PLAN_LAUNCHED", title: `${plan.campaignName} launched paused to Meta`, entityType: "Campaign", entityId: localCampaign.id, metadata: { campaignPlanId: planRow.id, externalCampaignId: campaign.id } })
    return { ok: true, campaignId: localCampaign.id, externalCampaignId: campaign.id, adGroupsPublished: 1 }
  } catch (error: any) {
    for (const id of [...remoteIds].reverse()) {
      await MetaAdsService.deleteObject(accessToken, id).catch((rollbackError: any) =>
        log("error", "services/meta-publish", "Rollback failed; manual cleanup required", { remoteId: id, message: rollbackError?.message })
      )
    }
    if (imageHash) {
      await MetaAdsService.deleteAdImage(accessToken, accountId, imageHash).catch((rollbackError: any) =>
        log("error", "services/meta-publish", "Image rollback failed; manual cleanup required", { imageHash, message: rollbackError?.message })
      )
    }
    const message = error?.message || "Meta campaign launch failed"
    log("error", "services/meta-publish", "Plan launch failed", { planRowId: planRow.id, message })
    await prisma.campaignPlan.update({ where: { id: planRow.id }, data: { status: "FAILED", plan: { ...(planRow.plan as any), lastLaunchError: message } } }).catch(() => undefined)
    return { ok: false, error: message, code: "PROVIDER_ERROR" }
  }
}
