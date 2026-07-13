import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { resolveUserId } from "@/lib/resolve-user"
import { prisma, logSchemaHealthOnce } from "@/lib/prisma"
import { log } from "@/lib/logger"
import { getRequestWorkspaceId, workspaceWhere } from "@/lib/workspace"
import { verifiedMetricCampaignWhere } from "@/lib/data-trust"
import { getActiveAdAccountScope } from "@/lib/account-scope"
import { logSlowApi } from "@/lib/api-timing"
import { accountIdVariants } from "@/lib/account-id"

const PLATFORMS = ["GOOGLE"] as const
type PlatformKey = (typeof PLATFORMS)[number]
const ENABLED_METRIC_PLATFORMS = PLATFORMS
type ConnectionState = {
  platform: PlatformKey
  integrationId: string
  hasAdsAccess: boolean
  hasAdsAccount: boolean
  selectedAdAccountId: string | null
  hasSelectedAdAccount: boolean
  lastSyncedAt: string | null
  status: string | null
}
function pctChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100
  return Number((((current - previous) / previous) * 100).toFixed(1))
}

function aggregateCampaigns(
  campaigns: Array<{
    spend: number | null
    impressions: number | null
    clicks: number | null
    conversions: number | null
    roas: number | null
    ctr: number | null
    cpc: number | null
  }>
) {
  const totalSpend = campaigns.reduce((sum, campaign) => sum + Number(campaign.spend || 0), 0)
  const totalImpressions = campaigns.reduce((sum, campaign) => sum + Number(campaign.impressions || 0), 0)
  const totalClicks = campaigns.reduce((sum, campaign) => sum + Number(campaign.clicks || 0), 0)
  const totalConversions = campaigns.reduce((sum, campaign) => sum + Number(campaign.conversions || 0), 0)
  const avgRoas = campaigns.length ? campaigns.reduce((sum, campaign) => sum + Number(campaign.roas || 0), 0) / campaigns.length : 0
  const avgCtr = campaigns.length ? campaigns.reduce((sum, campaign) => sum + Number(campaign.ctr || 0), 0) / campaigns.length : 0
  const avgCpc = campaigns.length ? campaigns.reduce((sum, campaign) => sum + Number(campaign.cpc || 0), 0) / campaigns.length : 0

  return { totalSpend, totalImpressions, totalClicks, totalConversions, avgRoas, avgCtr, avgCpc }
}

function buildKpi(current: number, previous: number) {
  return {
    current: Number(current.toFixed(2)),
    previous: Number(previous.toFixed(2)),
    changePercent: pctChange(current, previous),
  }
}

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const startedAtMs = Date.now()
  try {
    await logSchemaHealthOnce()
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const userId = await resolveUserId(session.user.id)
    const workspaceId = await getRequestWorkspaceId(userId, request)
    const workspaceFilter = workspaceWhere(workspaceId, false)

    // Pull all integrations for connection state (even if hasAdsAccess=false), then
    // derive "metric-enabled" integrations from that. This keeps the UI consistent:
    // connected vs no-ads-access vs connected-but-no-data.
    const allIntegrations = await prisma.integration.findMany({
      where: {
        userId,
        ...workspaceFilter,
        platform: { in: [...ENABLED_METRIC_PLATFORMS] as any },
      },
      select: {
        id: true,
        platform: true,
        hasAdsAccount: true,
        hasAdsAccess: true,
        selectedAdAccountId: true,
        accountId: true,
        selectedAdAccountName: true,
        accountName: true,
        lastSyncedAt: true,
        lastSyncAt: true,
        status: true,
        adAccounts: {
          where: { workspaceId },
          select: { externalId: true, name: true, isPrimary: true },
          orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }],
        },
      },
    })

    const connectionStates: Record<PlatformKey, ConnectionState | null> = {
      GOOGLE: null,
    }

    for (const integration of allIntegrations) {
      const platform = integration.platform as PlatformKey
      const selectedMappedAccount =
        integration.adAccounts.find((account) => account.externalId === integration.selectedAdAccountId) ||
        integration.adAccounts.find((account) => account.isPrimary) ||
        null
      const selectedAdAccountId = (integration.hasAdsAccess ? selectedMappedAccount?.externalId : null) as string | null
      const lastSynced = (integration.lastSyncedAt || integration.lastSyncAt || null) as Date | null
      connectionStates[platform] = {
        platform,
        integrationId: integration.id,
        hasAdsAccess: Boolean(integration.hasAdsAccess),
        hasAdsAccount: Boolean(selectedAdAccountId),
        selectedAdAccountId,
        hasSelectedAdAccount: Boolean(selectedAdAccountId),
        lastSyncedAt: lastSynced ? lastSynced.toISOString() : null,
        status: (integration.status as string) || null,
      }
    }

    const metricIntegrations = allIntegrations.filter((integration) => {
      const selectedMappedAccount =
        integration.adAccounts.find((account) => account.externalId === integration.selectedAdAccountId) ||
        integration.adAccounts.find((account) => account.isPrimary)
      return Boolean(integration.hasAdsAccess && selectedMappedAccount)
    })
    const accountConnectedIntegrations = metricIntegrations
    const connectedPlatforms = [...new Set(metricIntegrations.map((integration) => integration.platform as PlatformKey))]
    const requestedAdAccountId = request.nextUrl.searchParams.get("adAccountId")
    const activeScope = await getActiveAdAccountScope(userId, workspaceId, requestedAdAccountId)
    const integrationIds = activeScope
      ? [activeScope.integrationId]
      : metricIntegrations.map((integration) => integration.id)
    const selectedAdAccountIdsRaw = activeScope
      ? [activeScope.adAccountId]
      : metricIntegrations
          .map((integration) =>
            integration.adAccounts.find((account) => account.externalId === integration.selectedAdAccountId)?.externalId ||
            integration.adAccounts.find((account) => account.isPrimary)?.externalId
          )
          .filter(Boolean) as string[]
    const selectedAdAccountIds = Array.from(new Set(selectedAdAccountIdsRaw.flatMap((id) => accountIdVariants(id))))

    const campaignsWithAccountFilter = integrationIds.length && selectedAdAccountIds.length
      ? await prisma.campaign.findMany({
          where: {
            ...verifiedMetricCampaignWhere({ userId, workspaceId }),
            integrationId: { in: integrationIds },
            adAccountId: { in: selectedAdAccountIds },
            platform: { in: connectedPlatforms as any },
          },
          orderBy: { spend: "desc" },
        })
      : []
    const campaigns = campaignsWithAccountFilter.length > 0
      ? campaignsWithAccountFilter
      : integrationIds.length
        ? await prisma.campaign.findMany({
            where: {
              ...verifiedMetricCampaignWhere({ userId, workspaceId }),
              integrationId: { in: integrationIds },
              platform: { in: connectedPlatforms as any },
            },
            orderBy: { spend: "desc" },
          })
        : []

    const current = aggregateCampaigns(campaigns)
    const metricWindowEnd = new Date()
    const metricWindowStart = new Date(metricWindowEnd)
    metricWindowStart.setDate(metricWindowStart.getDate() - 30)
    const previousWindowStart = new Date(metricWindowStart)
    previousWindowStart.setDate(previousWindowStart.getDate() - 30)

    const previousMetricsWithAccountFilter =
      connectedPlatforms.length > 0 && selectedAdAccountIds.length > 0
        ? await prisma.campaignMetricDaily.findMany({
            where: {
              campaign: {
                ...verifiedMetricCampaignWhere({ userId, workspaceId }),
                integrationId: { in: integrationIds },
                adAccountId: { in: selectedAdAccountIds },
                platform: { in: connectedPlatforms as any },
              },
              metricDate: {
                gte: previousWindowStart,
                lt: metricWindowStart,
              },
            },
            select: {
              spend: true,
              impressions: true,
              clicks: true,
              conversions: true,
              roas: true,
              ctr: true,
              cpa: true,
            },
          })
        : []
    const previousMetrics =
      previousMetricsWithAccountFilter.length > 0
        ? previousMetricsWithAccountFilter
        : connectedPlatforms.length > 0
          ? await prisma.campaignMetricDaily.findMany({
              where: {
                campaign: {
                  ...verifiedMetricCampaignWhere({ userId, workspaceId }),
                  integrationId: { in: integrationIds },
                  platform: { in: connectedPlatforms as any },
                },
                metricDate: {
                  gte: previousWindowStart,
                  lt: metricWindowStart,
                },
              },
              select: {
                spend: true,
                impressions: true,
                clicks: true,
                conversions: true,
                roas: true,
                ctr: true,
                cpa: true,
              },
            })
          : []

    const currentMetricsWithAccountFilter =
      connectedPlatforms.length > 0 && selectedAdAccountIds.length > 0
        ? await prisma.campaignMetricDaily.findMany({
            where: {
              campaign: {
                ...verifiedMetricCampaignWhere({ userId, workspaceId }),
                integrationId: { in: integrationIds },
                adAccountId: { in: selectedAdAccountIds },
                platform: { in: connectedPlatforms as any },
              },
              metricDate: {
                gte: metricWindowStart,
                lte: metricWindowEnd,
              },
            },
            select: {
              metricDate: true,
              spend: true,
              revenue: true,
              conversions: true,
            },
            orderBy: { metricDate: "asc" },
          })
        : []
    const currentMetrics =
      currentMetricsWithAccountFilter.length > 0
        ? currentMetricsWithAccountFilter
        : connectedPlatforms.length > 0
          ? await prisma.campaignMetricDaily.findMany({
              where: {
                campaign: {
                  ...verifiedMetricCampaignWhere({ userId, workspaceId }),
                  integrationId: { in: integrationIds },
                  platform: { in: connectedPlatforms as any },
                },
                metricDate: {
                  gte: metricWindowStart,
                  lte: metricWindowEnd,
                },
              },
              select: {
                metricDate: true,
                spend: true,
                revenue: true,
                conversions: true,
              },
              orderBy: { metricDate: "asc" },
            })
          : []

    const spendByDay = Object.values(
      currentMetrics.reduce(
        (acc, metric) => {
          const date = metric.metricDate.toISOString().slice(0, 10)
          acc[date] ||= { date, spend: 0, revenue: 0, conversions: 0 }
          acc[date].spend += Number(metric.spend || 0)
          acc[date].revenue += Number(metric.revenue || 0)
          acc[date].conversions += Number(metric.conversions || 0)
          return acc
        },
        {} as Record<string, { date: string; spend: number; revenue: number; conversions: number }>
      )
    ).map((item) => ({ ...item, spend: Number(item.spend.toFixed(2)), revenue: Number(item.revenue.toFixed(2)), conversions: Number(item.conversions.toFixed(2)) }))

    const previous = previousMetrics.length
      ? aggregateCampaigns(
          previousMetrics.map((metric) => ({
            spend: metric.spend,
            impressions: metric.impressions,
            clicks: metric.clicks,
            conversions: metric.conversions,
            roas: metric.roas || 0,
            ctr: metric.ctr || 0,
            cpc: metric.cpa || 0,
          }))
        )
      : {
          totalSpend: 0,
          totalImpressions: 0,
          totalClicks: 0,
          totalConversions: 0,
          avgRoas: 0,
          avgCtr: 0,
          avgCpc: 0,
        }

    const byPlatform = PLATFORMS.reduce(
      (acc, platform) => {
        if (!connectedPlatforms.includes(platform)) {
          acc[platform] = null
          return acc
        }

        const platformCampaigns = campaigns.filter((campaign) => campaign.platform === platform)
        const totals = aggregateCampaigns(platformCampaigns)
        acc[platform] = {
          spend: Number(totals.totalSpend.toFixed(2)),
          impressions: totals.totalImpressions,
          clicks: totals.totalClicks,
          conversions: Number(totals.totalConversions.toFixed(2)),
          avgRoas: Number(totals.avgRoas.toFixed(2)),
          campaigns: platformCampaigns.length,
        }
        return acc
      },
      {} as Record<PlatformKey, null | { spend: number; impressions: number; clicks: number; conversions: number; avgRoas: number; campaigns: number }>
    )

    const topCampaigns = campaigns.slice(0, 3).map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      spend: Number(campaign.spend || 0),
      impressions: Number(campaign.impressions || 0),
      conversions: Number(campaign.conversions || 0),
      roas: Number(campaign.roas || 0),
    }))

    const lastSyncedAt =
      metricIntegrations
        .map((integration) => integration.lastSyncedAt || integration.lastSyncAt)
        .filter(Boolean)
        .sort((a, b) => Number(b) - Number(a))[0]
        ?.toISOString() || null

    const totals = {
      spend: Number(current.totalSpend.toFixed(2)),
      impressions: current.totalImpressions,
      clicks: current.totalClicks,
      conversions: Number(current.totalConversions.toFixed(2)),
      avgRoas: Number(current.avgRoas.toFixed(2)),
      avgCtr: Number(current.avgCtr.toFixed(2)),
      avgCpc: Number(current.avgCpc.toFixed(2)),
    }
    const isStale = lastSyncedAt ? Date.now() - new Date(lastSyncedAt).getTime() > 24 * 60 * 60 * 1000 : false

    return NextResponse.json(
      {
        connections: connectionStates,
        connectedPlatforms,
        selectedAdAccountId: activeScope?.adAccountId || null,
        hasAnyConnectedAccount: accountConnectedIntegrations.length > 0,
        connectedAccountPlatforms: [...new Set(accountConnectedIntegrations.map((integration) => integration.platform as PlatformKey))],
        totals,
        byPlatform,
        hasCampaignData: campaigns.length > 0,
        totalSpend: totals.spend,
        totalImpressions: totals.impressions,
        totalClicks: totals.clicks,
        totalConversions: totals.conversions,
        avgRoas: totals.avgRoas,
        avgCtr: totals.avgCtr,
        avgCpc: totals.avgCpc,
        kpis: {
          spend: buildKpi(current.totalSpend, previous.totalSpend),
          impressions: buildKpi(current.totalImpressions, previous.totalImpressions),
          conversions: buildKpi(current.totalConversions, previous.totalConversions),
          roas: buildKpi(current.avgRoas, previous.avgRoas),
        },
        topCampaigns,
        spendByDay,
        lastSyncedAt,
        isStale,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    )
  } catch (error: any) {
    log("error", "api/dashboard/stats", "Failed to load dashboard stats", { message: error?.message, stack: error?.stack })
    return NextResponse.json({ error: "Failed to load dashboard stats" }, { status: 500 })
  } finally {
    logSlowApi("/api/dashboard/stats", startedAtMs)
  }
}
