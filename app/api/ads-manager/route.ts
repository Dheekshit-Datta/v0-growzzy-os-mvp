import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId } from "@/lib/workspace"
import { verifiedCampaignWhere } from "@/lib/data-trust"
import { logSlowApi } from "@/lib/api-timing"
import { accountIdVariants, normalizeAccountId } from "@/lib/account-id"
import type { IntegrationPlatform, Prisma } from "@prisma/client"

export const dynamic = "force-dynamic"

function sum<T>(items: T[], getter: (item: T) => number | null | undefined) {
  return items.reduce((total, item) => total + (getter(item) || 0), 0)
}

function weightedRate(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0
}

function isStaleSync(value?: Date | null) {
  if (!value) return true
  return Date.now() - value.getTime() > 24 * 60 * 60 * 1000
}
export async function GET(req: NextRequest) {
  const startedAtMs = Date.now()
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = await resolveUserId(session.user.id)
  const workspaceId = await getRequestWorkspaceId(userId, req)

  const integrations = await prisma.integration.findMany({
    where: {
      userId,
      workspaceId,
      hasAdsAccess: true,
      status: "ACTIVE",
      platform: { in: ["GOOGLE", "META"] },
    },
    select: {
      id: true,
      platform: true,
      accountName: true,
      selectedAdAccountId: true,
      lastSyncedAt: true,
      adAccounts: {
        where: { isPrimary: true },
        select: {
          externalId: true,
          name: true,
          currencyCode: true,
          isPrimary: true,
        },
      },
    },
  })

  const requestedAdAccountId = req.nextUrl.searchParams.get("adAccountId")
  const validAccountIds = new Set(
    integrations.flatMap((integration) => integration.adAccounts.map((account) => account.externalId)).filter(Boolean) as string[]
  )
  const requestedNormalized = normalizeAccountId(requestedAdAccountId)
  const matchedRequestedAccountId =
    requestedAdAccountId &&
    ([...validAccountIds].find((id) => normalizeAccountId(id) === requestedNormalized) || null)
  const selectedAdAccountId =
    matchedRequestedAccountId ||
    integrations.flatMap((integration) => integration.adAccounts).find((account) => account.isPrimary)?.externalId ||
    null
  const platform = req.nextUrl.searchParams.get("platform")
  const status = req.nextUrl.searchParams.get("status")
  const objective = req.nextUrl.searchParams.get("objective")
  const liveStatus = req.nextUrl.searchParams.get("liveStatus")
  const minSpend = Number(req.nextUrl.searchParams.get("minSpend") || 0)
  const maxSpend = Number(req.nextUrl.searchParams.get("maxSpend") || 0)
  const minRoas = Number(req.nextUrl.searchParams.get("minRoas") || 0)
  const maxRoas = Number(req.nextUrl.searchParams.get("maxRoas") || 0)
  const staleOnly = req.nextUrl.searchParams.get("staleOnly") === "1"
  const verifiedOnly = req.nextUrl.searchParams.get("verifiedOnly") === "1"
  const parsedPlatform = platform && platform !== "ALL" ? (platform as IntegrationPlatform) : null
  const parsedStatus = status && status !== "ALL" ? status : null
  const parsedLiveStatus = liveStatus && liveStatus !== "ALL" ? liveStatus : null
  const parsedObjective = objective && objective !== "ALL" ? objective : null

  const andClauses: Prisma.CampaignWhereInput[] = [
    verifiedOnly ? verifiedCampaignWhere({ userId, workspaceId }) : { userId, workspaceId },
  ]
  if (selectedAdAccountId) {
    const variants = accountIdVariants(selectedAdAccountId)
    andClauses.push({
      OR: variants.map((id) => ({ adAccountId: id })),
    })
  }
  if (parsedPlatform) andClauses.push({ platform: parsedPlatform })
  if (parsedStatus) andClauses.push({ status: parsedStatus })
  if (parsedLiveStatus) andClauses.push({ liveStatus: parsedLiveStatus })
  if (parsedObjective) andClauses.push({ OR: [{ objective: parsedObjective }, { goal: parsedObjective }, { type: parsedObjective }] })
  if (minSpend > 0) andClauses.push({ spend: { gte: minSpend } })
  if (maxSpend > 0) andClauses.push({ spend: { lte: maxSpend } })
  if (minRoas > 0) andClauses.push({ roas: { gte: minRoas } })
  if (maxRoas > 0) andClauses.push({ roas: { lte: maxRoas } })

  const campaignWhere: Prisma.CampaignWhereInput = { AND: andClauses }

  const campaigns = selectedAdAccountId ? await prisma.campaign.findMany({
    where: campaignWhere,
    include: {
      integration: { select: { platform: true, accountName: true, lastSyncedAt: true } },
      adGroups: {
        select: {
          id: true,
          name: true,
          status: true,
          _count: { select: { keywords: true, ads: true } },
        },
      },
      adSets: {
        select: {
          id: true,
          name: true,
          status: true,
          budgetAmount: true,
          _count: { select: { ads: true } },
        },
      },
      metricsDaily: {
        orderBy: { metricDate: "desc" },
        take: 14,
        select: {
          metricDate: true,
          spend: true,
          conversions: true,
          revenue: true,
          clicks: true,
          impressions: true,
          ctr: true,
          cpa: true,
          roas: true,
        },
      },
      optimizationLogs: {
        orderBy: { appliedAt: "desc" },
        take: 3,
        select: {
          id: true,
          type: true,
          status: true,
          apiSuccess: true,
          appliedAt: true,
          previousValue: true,
          appliedValue: true,
        },
      },
    },
    orderBy: [{ spend: "desc" }, { updatedAt: "desc" }],
  }) : []

  const spend = sum(campaigns, (campaign) => campaign.spend || campaign.totalSpend)
  const revenue = sum(campaigns, (campaign) => campaign.revenue || campaign.totalRevenue)
  const clicks = sum(campaigns, (campaign) => campaign.clicks)
  const impressions = sum(campaigns, (campaign) => campaign.impressions)
  const conversions = sum(campaigns, (campaign) => campaign.conversions || campaign.totalConversions)

  const staleIntegrations = integrations.filter((integration) => isStaleSync(integration.lastSyncedAt))
  const hasStaleData = staleIntegrations.length > 0
  const metaEnabled = process.env.ENABLE_META_ADS === "true"
  const staleCampaignIds = new Set(
    campaigns
      .filter((campaign) => isStaleSync(campaign.integration?.lastSyncedAt))
      .map((campaign) => campaign.id)
  )

  const filteredByStale = staleOnly ? campaigns.filter((campaign) => staleCampaignIds.has(campaign.id)) : campaigns

  const accountRows = integrations.flatMap((integration) => {
    const primaryRows = integration.adAccounts.map((account) => ({
      ...account,
      platform: integration.platform,
      integrationId: integration.id,
      integrationName: integration.accountName,
      lastSyncedAt: integration.lastSyncedAt,
    }))
    if (primaryRows.length > 0) return primaryRows
    const fallbackExternalId = integration.selectedAdAccountId
    if (!fallbackExternalId) return []
    return [
      {
        externalId: fallbackExternalId,
        name: integration.accountName || fallbackExternalId,
        currencyCode: "USD",
        isPrimary: true,
        platform: integration.platform,
        integrationId: integration.id,
        integrationName: integration.accountName,
        lastSyncedAt: integration.lastSyncedAt,
      },
    ]
  })

  try {
    return NextResponse.json({
      ok: true,
      workspaceId,
      selectedAdAccountId,
      connectedPlatforms: integrations.map((integration) => integration.platform),
      accounts: accountRows,
      summary: {
      spend,
      revenue,
      impressions,
      clicks,
      conversions,
      ctr: weightedRate(clicks, impressions) * 100,
      cpa: conversions > 0 ? spend / conversions : 0,
      roas: spend > 0 ? revenue / spend : 0,
      activeCampaigns: campaigns.filter((campaign) => ["ACTIVE", "ENABLED"].includes(campaign.status)).length,
    },
    campaigns: filteredByStale.map((campaign) => ({
      id: campaign.id,
      platform: campaign.platform,
      adAccountId: campaign.adAccountId,
      name: campaign.name,
      status: campaign.status,
      liveStatus: campaign.liveStatus,
      objective: campaign.objective || campaign.goal || campaign.type,
      budget: campaign.budgetAmount || campaign.dailyBudget || 0,
      spend: campaign.spend || campaign.totalSpend,
      revenue: campaign.revenue || campaign.totalRevenue,
      impressions: campaign.impressions,
      clicks: campaign.clicks,
      conversions: campaign.conversions || campaign.totalConversions,
      ctr: campaign.ctr || weightedRate(campaign.clicks, campaign.impressions) * 100,
      cpa: campaign.cpa || ((campaign.conversions || campaign.totalConversions) > 0 ? (campaign.spend || campaign.totalSpend) / (campaign.conversions || campaign.totalConversions) : 0),
      roas: campaign.roas || ((campaign.spend || campaign.totalSpend) > 0 ? (campaign.revenue || campaign.totalRevenue) / (campaign.spend || campaign.totalSpend) : 0),
      verifiedAt: campaign.verifiedAt,
      syncedAt: campaign.syncedAt,
      adGroups: campaign.adGroups,
      adSets: campaign.adSets,
      latestChanges: campaign.optimizationLogs,
      metricsDaily: campaign.metricsDaily.reverse(),
      preflight: {
        canMutate:
          campaign.platform === "GOOGLE"
            ? !isStaleSync(campaign.integration?.lastSyncedAt)
            : campaign.platform === "META"
              ? metaEnabled && !isStaleSync(campaign.integration?.lastSyncedAt)
              : false,
        code:
          campaign.platform === "META" && !metaEnabled
              ? "PREFLIGHT_BLOCK"
              : isStaleSync(campaign.integration?.lastSyncedAt)
                ? "STALE_DATA_BLOCK"
                : null,
        remediationChecklist:
          campaign.platform === "META" && !metaEnabled
              ? [
                  "Set ENABLE_META_ADS=true in environment.",
                  "Ensure app tester role is accepted in Meta App Roles.",
                  "Reconnect Meta integration and run Sync.",
                ]
              : isStaleSync(campaign.integration?.lastSyncedAt)
                ? ["Run Sync Now.", "Confirm token is active.", "Retry after fresh sync (<24h)."]
                : [],
      },
    })),
      trust: {
      source: verifiedOnly ? "Verified live platform sync only" : "Workspace campaigns",
      excludesDrafts: verifiedOnly,
      excludesSeedData: true,
      hasStaleData,
      staleIntegrations: staleIntegrations.map((integration) => integration.id),
      emptyMessage: verifiedOnly ? "No verified live campaigns synced for this ad account yet." : "No campaigns found for this ad account yet.",
      selectedFilters: {
        platform: platform || "ALL",
        status: status || "ALL",
        objective: objective || "ALL",
        liveStatus: liveStatus || "ALL",
        minSpend,
        maxSpend,
        minRoas,
        maxRoas,
        staleOnly,
        verifiedOnly,
      },
      },
    })
  } finally {
    logSlowApi("/api/ads-manager", startedAtMs)
  }
}
