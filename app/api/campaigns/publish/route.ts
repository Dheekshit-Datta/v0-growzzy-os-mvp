import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId, workspaceWhere } from "@/lib/workspace"
import {
  createGoogleAdGroup,
  createGoogleAdsCampaign,
  createGoogleKeywords,
  createGoogleResponsiveSearchAd,
  updateGoogleCampaignStatus,
} from "@/lib/platform-actions"
import { isUnverifiedExternalId } from "@/lib/data-trust"
import { log } from "@/lib/logger"
import { classifyActionError, createCorrelationId } from "@/lib/action-response"
import { recordActivity } from "@/lib/activity-log"
import { getIntegrationAccessToken } from "@/lib/integration-tokens"
import { rateLimitPolicy, rateLimitResponse } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

type PublishBody = {
  campaignId: string
  adGroup: { name: string; theme?: string; defaultBid?: number }
  keywords: Array<{ text: string; matchType: "BROAD" | "PHRASE" | "EXACT"; isNegative?: boolean; bid?: number }>
  ad: {
    headlines: Array<{ text: string; pinPosition?: number | null }>
    descriptions: Array<{ text: string }>
    finalUrl: string
    displayPath1?: string
    displayPath2?: string
  }
}

function invalid(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

export async function POST(req: NextRequest) {
  const correlationId = createCorrelationId()
  let publishContext: { userId: string; workspaceId: string; adAccountId: string | null; campaignId: string; name: string } | null = null
  let createdCampaignId: string | null = null
  let rollbackAccess: { accessToken: string; customerId: string; loginCustomerId: string } | null = null
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ ok: false, error: "Unauthorized", correlationId, code: "UNAUTHORIZED" }, { status: 401 })
    const userId = await resolveUserId(session.user.id)
    const limit = await rateLimitPolicy(userId, "campaignLaunch")
    if (!limit.allowed) return rateLimitResponse(limit)
    const workspaceId = await getRequestWorkspaceId(userId, req)
    const body = (await req.json()) as PublishBody

    if (!body.campaignId) return NextResponse.json({ ok: false, error: "campaignId is required", correlationId, code: "VALIDATION_FAILED" }, { status: 400 })
    if (!body.adGroup?.name) return NextResponse.json({ ok: false, error: "Ad group name is required", correlationId, code: "VALIDATION_FAILED" }, { status: 400 })
    if (!Array.isArray(body.keywords) || body.keywords.filter((keyword) => keyword.text).length < 1) {
      return NextResponse.json({ ok: false, error: "At least one keyword is required before publishing", correlationId, code: "VALIDATION_FAILED" }, { status: 400 })
    }
    if (!body.ad?.finalUrl) return NextResponse.json({ ok: false, error: "Final URL is required before publishing", correlationId, code: "VALIDATION_FAILED" }, { status: 400 })
    if (!Array.isArray(body.ad.headlines) || body.ad.headlines.filter((item) => item.text).length < 3) {
      return NextResponse.json({ ok: false, error: "At least three RSA headlines are required before publishing", correlationId, code: "VALIDATION_FAILED" }, { status: 400 })
    }
    if (!Array.isArray(body.ad.descriptions) || body.ad.descriptions.filter((item) => item.text).length < 1) {
      return NextResponse.json({ ok: false, error: "At least one RSA description is required before publishing", correlationId, code: "VALIDATION_FAILED" }, { status: 400 })
    }

    const campaign = await prisma.campaign.findFirst({
      where: { id: body.campaignId, userId, ...workspaceWhere(workspaceId, false) },
      include: { integration: true, adAccount: true },
    })
    if (!campaign) return NextResponse.json({ ok: false, error: "Campaign draft not found", correlationId, code: "NOT_FOUND" }, { status: 404 })
    if (campaign.platform !== "GOOGLE") return NextResponse.json({ ok: false, error: "Only Google Ads live publishing is enabled for beta", correlationId, code: "PREFLIGHT_BLOCK" }, { status: 403 })
    if (campaign.isLive && !isUnverifiedExternalId(campaign.externalId)) {
      return NextResponse.json({ ok: false, error: "This campaign is already live. Use Ads Manager for live changes.", correlationId, code: "ALREADY_LIVE" }, { status: 409 })
    }
    const dailyBudget = Number(campaign.budgetAmount || campaign.dailyBudget || 1)
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { dailyBudgetCeiling: true },
    })
    if (workspace?.dailyBudgetCeiling != null) {
      const activeBudget = await prisma.campaign.aggregate({
        where: { workspaceId, isLive: true, id: { not: campaign.id } },
        _sum: { budgetAmount: true },
      })
      if (Number(activeBudget._sum.budgetAmount || 0) + dailyBudget > workspace.dailyBudgetCeiling) {
        return NextResponse.json({ ok: false, error: "This launch exceeds the workspace daily budget ceiling.", correlationId, code: "BUDGET_CEILING" }, { status: 409 })
      }
    }
    const accessToken = getIntegrationAccessToken(campaign.integration)
    if (!campaign.integration.hasAdsAccess || !accessToken) return NextResponse.json({ ok: false, error: "Reconnect Google Ads before publishing", correlationId, code: "AUTH_REQUIRED" }, { status: 401 })

    const customerId = campaign.adAccountExternalId || campaign.adAccount?.externalId || campaign.integration.selectedAdAccountId || campaign.integration.accountId || ""
    if (!customerId) return NextResponse.json({ ok: false, error: "No selected Google Ads account found", correlationId, code: "PREFLIGHT_BLOCK" }, { status: 400 })
    publishContext = { userId, workspaceId, adAccountId: campaign.adAccountId || campaign.adAccount?.id || customerId, campaignId: campaign.id, name: campaign.name }
    rollbackAccess = { accessToken, customerId, loginCustomerId: customerId }

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { liveStatus: "PUBLISHING", liveError: null },
    })

    let googleCampaignId = campaign.externalId
    let budgetResourceName = campaign.externalBudgetId

    if (!campaign.isLive || isUnverifiedExternalId(campaign.externalId)) {
      const campaignResult = await createGoogleAdsCampaign({
        accessToken,
        customerId,
        name: campaign.name,
        dailyBudgetMicros: Math.round(dailyBudget * 1_000_000),
        objective: campaign.type === "DISPLAY" || campaign.type === "VIDEO" ? campaign.type : "SEARCH",
        biddingStrategy: campaign.biddingStrategy === "MAXIMIZE_CLICKS" || campaign.biddingStrategy === "TARGET_CPA" ? campaign.biddingStrategy : "MAXIMIZE_CONVERSIONS",
        targetCpaMicros: campaign.targetCpa ? Math.round(campaign.targetCpa * 1_000_000) : null,
        status: "PAUSED",
        loginCustomerId: customerId,
      })
      googleCampaignId = campaignResult.campaignId
      createdCampaignId = campaignResult.campaignId
      budgetResourceName = campaignResult.budgetResourceName || null
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          externalId: googleCampaignId,
          externalBudgetId: budgetResourceName,
          rawData: { publishCorrelationId: correlationId, providerCampaignId: googleCampaignId, stage: "CAMPAIGN_CREATED" },
        },
      })
    }

    const adGroupResult = await createGoogleAdGroup({
      accessToken,
      customerId,
      campaignId: googleCampaignId,
      name: body.adGroup.name,
      defaultBidMicros: body.adGroup.defaultBid ? Math.round(body.adGroup.defaultBid * 1_000_000) : null,
      loginCustomerId: customerId,
    })

    await createGoogleKeywords({
      accessToken,
      customerId,
      adGroupId: adGroupResult.resourceName || adGroupResult.adGroupId,
      keywords: body.keywords,
      loginCustomerId: customerId,
    })

    const adResult = await createGoogleResponsiveSearchAd({
      accessToken,
      customerId,
      adGroupId: adGroupResult.resourceName || adGroupResult.adGroupId,
      headlines: body.ad.headlines,
      descriptions: body.ad.descriptions,
      finalUrl: body.ad.finalUrl,
      displayPath1: body.ad.displayPath1 || null,
      displayPath2: body.ad.displayPath2 || null,
      loginCustomerId: customerId,
    })

    const updatedCampaign = await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        externalId: googleCampaignId,
        externalBudgetId: budgetResourceName,
        isLive: true,
        liveStatus: "LIVE_PAUSED",
        status: "PAUSED",
        liveError: null,
        verifiedAt: new Date(),
        syncedAt: new Date(),
        hasCreative: true,
      },
    })

    const adGroup = await prisma.adGroup.create({
      data: {
        userId,
        campaignId: campaign.id,
        externalId: adGroupResult.adGroupId,
        name: body.adGroup.name,
        theme: body.adGroup.theme || null,
        defaultBid: body.adGroup.defaultBid || null,
        isLive: true,
      },
    })

    await prisma.keyword.createMany({
      data: body.keywords.map((keyword) => ({
        userId,
        adGroupId: adGroup.id,
        text: keyword.text,
        matchType: keyword.matchType,
        isNegative: !!keyword.isNegative,
        bid: keyword.bid || null,
      })),
    })

    await prisma.ad.create({
      data: {
        userId,
        adGroupId: adGroup.id,
        externalId: adResult.adId,
        resourceName: adResult.resourceName,
        headlines: body.ad.headlines,
        descriptions: body.ad.descriptions,
        finalUrl: body.ad.finalUrl,
        displayPath1: body.ad.displayPath1 || null,
        displayPath2: body.ad.displayPath2 || null,
        adStrength: body.ad.headlines.length >= 10 && body.ad.descriptions.length >= 2 ? "GOOD" : "AVERAGE",
        isLive: true,
      },
    })

    await recordActivity({
      userId,
      workspaceId,
      adAccountId: campaign.adAccountId || campaign.adAccount?.id || customerId,
      type: "CAMPAIGN_PUBLISHED_PAUSED",
      title: `${campaign.name} published paused`,
      entityType: "Campaign",
      entityId: campaign.id,
      metadata: { correlationId, platform: "GOOGLE", externalId: googleCampaignId },
    })

    return NextResponse.json({
      ok: true,
      correlationId,
      campaign: updatedCampaign,
      adGroup,
      message: "Full Google Ads hierarchy published in PAUSED state: budget, campaign, ad group, keywords, and RSA.",
    })
  } catch (error: any) {
    log("error", "api/campaigns/publish", "Google publish failed", { message: error?.message, stack: error?.stack })
    const message = error?.message || "Google Ads publish failed. No success was recorded."
    let rollback: { attempted: boolean; success: boolean; error?: string } = { attempted: false, success: false }
    if (createdCampaignId && rollbackAccess) {
      rollback.attempted = true
      try {
        await updateGoogleCampaignStatus({
          accessToken: rollbackAccess.accessToken,
          customerId: rollbackAccess.customerId,
          campaignId: createdCampaignId,
          status: "REMOVED",
          loginCustomerId: rollbackAccess.loginCustomerId,
        })
        rollback.success = true
      } catch (rollbackError: any) {
        rollback.error = rollbackError?.message || "Provider rollback failed"
      }
    }
    if (publishContext) {
      await prisma.campaign.update({
        where: { id: publishContext.campaignId },
        data: {
          isLive: false,
          liveStatus: "FAILED",
          liveError: message,
          rawData: { publishCorrelationId: correlationId, failure: message, rollback },
        },
      }).catch(() => undefined)
      await recordActivity({
        userId: publishContext.userId,
        workspaceId: publishContext.workspaceId,
        adAccountId: publishContext.adAccountId,
        type: "CAMPAIGN_PUBLISH_FAILED",
        title: `${publishContext.name} failed to publish`,
        message,
        entityType: "Campaign",
        entityId: publishContext.campaignId,
        metadata: { correlationId, rollback },
      })
    }
    return NextResponse.json(
      { ok: false, error: message, correlationId, code: classifyActionError(message), rollback },
      { status: 502 }
    )
  }
}
