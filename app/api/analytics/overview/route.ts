import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId, workspaceWhere } from "@/lib/workspace"
import { verifiedMetricCampaignWhere } from "@/lib/data-trust"
import { log } from "@/lib/logger"

export const dynamic = "force-dynamic"

function round2(value: number) {
  return Number(value.toFixed(2))
}

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED" } }, { status: 401 })
    }

    const userId = await resolveUserId(session.user.id)
    const workspaceId = await getRequestWorkspaceId(userId, request as any)
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get("days") || "30", 10)

    const now = new Date()
    const currentStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

    const workspaceFilter = workspaceWhere(workspaceId, false)
    const integrations = await prisma.integration.findMany({
      where: { userId, ...workspaceFilter, hasAdsAccess: true, status: "ACTIVE" },
      select: { platform: true, selectedAdAccountName: true, lastSyncAt: true, selectedAdAccountId: true, accountId: true },
    })
    const selectedAdAccountIds = integrations
      .map((i) => i.selectedAdAccountId || i.accountId)
      .filter(Boolean) as string[]

    const [campaigns, leadsCount] = await Promise.all([
      prisma.campaign.findMany({
        where: {
          ...verifiedMetricCampaignWhere({ userId, workspaceId }),
          ...(selectedAdAccountIds.length ? { adAccountId: { in: selectedAdAccountIds } } : { id: "__none__" }),
        },
        include: {
          metricsDaily: {
            where: { metricDate: { gte: currentStart, lte: now } },
            orderBy: { metricDate: "asc" },
          },
        },
        orderBy: { spend: "desc" },
      }),
      prisma.lead.count({
        where: {
          userId,
          ...workspaceFilter,
          createdAt: { gte: currentStart },
        },
      }),
    ])

    const summarizedCampaigns = campaigns.map((campaign) => {
      const spend = campaign.metricsDaily.reduce((sum, metric) => sum + Number(metric.spend || 0), 0)
      const revenue = campaign.metricsDaily.reduce((sum, metric) => sum + Number(metric.revenue || 0), 0)
      const clicks = campaign.metricsDaily.reduce((sum, metric) => sum + Number(metric.clicks || 0), 0)
      const impressions = campaign.metricsDaily.reduce((sum, metric) => sum + Number(metric.impressions || 0), 0)
      const conversions = campaign.metricsDaily.reduce((sum, metric) => sum + Number(metric.conversions || 0), 0)
      return {
        ...campaign,
        spend,
        revenue,
        clicks,
        impressions,
        conversions,
        roas: spend > 0 ? revenue / spend : 0,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      }
    }).filter((campaign) => campaign.metricsDaily.length > 0)

    const totalSpend = summarizedCampaigns.reduce((sum, c) => sum + Number(c.spend || 0), 0)
    const totalRevenue = summarizedCampaigns.reduce((sum, c) => sum + Number(c.revenue || 0), 0)
    const totalClicks = summarizedCampaigns.reduce((sum, c) => sum + Number(c.clicks || 0), 0)
    const totalImpressions = summarizedCampaigns.reduce((sum, c) => sum + Number(c.impressions || 0), 0)
    const totalConversions = summarizedCampaigns.reduce((sum, c) => sum + Number(c.conversions || 0), 0)
    const roas = totalSpend > 0 ? round2(totalRevenue / totalSpend) : 0
    const ctr = totalImpressions > 0 ? round2((totalClicks / totalImpressions) * 100) : 0
    const activeCampaigns = summarizedCampaigns.filter((c) => ["ACTIVE", "active"].includes(String(c.status))).length

    const platformMap: Record<string, { spend: number; revenue: number; count: number }> = {}
    for (const campaign of summarizedCampaigns) {
      const name = String(campaign.platform || "OTHER").toUpperCase()
      if (!platformMap[name]) platformMap[name] = { spend: 0, revenue: 0, count: 0 }
      platformMap[name].spend += Number(campaign.spend || 0)
      platformMap[name].revenue += Number(campaign.revenue || 0)
      platformMap[name].count += 1
    }

    const platformBreakdown = Object.entries(platformMap)
      .map(([name, data]) => ({
        name,
        spend: data.spend,
        revenue: data.revenue,
        roas: data.spend > 0 ? round2(data.revenue / data.spend) : 0,
        campaigns: data.count,
        percentOfSpend: totalSpend > 0 ? round2((data.spend / totalSpend) * 100) : 0,
      }))
      .sort((a, b) => b.spend - a.spend)

    const chartMap: Record<string, { spend: number; revenue: number }> = {}
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      chartMap[d.toLocaleDateString("en-US", { month: "short", day: "numeric" })] = { spend: 0, revenue: 0 }
    }

    for (const campaign of summarizedCampaigns) {
      for (const metric of campaign.metricsDaily) {
        const dayLabel = new Date(metric.metricDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        if (!chartMap[dayLabel]) continue
        chartMap[dayLabel].spend += Number(metric.spend || 0)
        chartMap[dayLabel].revenue += Number(metric.revenue || 0)
      }
    }

    const chartData = Object.entries(chartMap).map(([date, vals]) => ({
      date,
      spend: Math.round(vals.spend),
      revenue: Math.round(vals.revenue),
    }))

    const sortedByRoas = [...summarizedCampaigns]
      .filter((c) => Number(c.spend || 0) > 0)
      .sort((a, b) => Number(b.roas || 0) - Number(a.roas || 0))

    const topCampaigns = sortedByRoas.slice(0, 5).map((c) => ({
      id: c.id,
      name: c.name,
      platform: c.platform,
      status: c.status,
      spend: Number(c.spend || 0),
      revenue: Number(c.revenue || 0),
      roas: Number(c.roas || 0),
    }))

    const bottomCampaigns = [...sortedByRoas].reverse().slice(0, 5).map((c) => ({
      id: c.id,
      name: c.name,
      platform: c.platform,
      status: c.status,
      spend: Number(c.spend || 0),
      revenue: Number(c.revenue || 0),
      roas: Number(c.roas || 0),
    }))

    return NextResponse.json({
      ok: true,
      data: {
        kpis: {
          totalSpend,
          totalRevenue,
          roas,
          ctr,
          totalClicks,
          totalImpressions,
          totalConversions,
          activeCampaigns,
          totalCampaigns: summarizedCampaigns.length,
          newLeads: leadsCount,
          connectedPlatforms: integrations.length,
        },
        platformBreakdown,
        topCampaigns,
        bottomCampaigns,
        chartData,
        platforms: integrations.map((i) => ({
          name: `${i.platform.charAt(0)}${i.platform.slice(1).toLowerCase()} Ads`,
          accountName: i.selectedAdAccountName,
          lastSynced: i.lastSyncAt,
          adAccountId: i.selectedAdAccountId || i.accountId,
        })),
        period: { days, from: currentStart.toISOString(), to: now.toISOString() },
      },
    })
  } catch (error: any) {
    log("error", "api/analytics/overview", "Failed to load verified analytics", { message: error?.message })
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INTERNAL",
          message: error.message || "Failed to load analytics.",
        },
      },
      { status: 500 },
    )
  }
}
