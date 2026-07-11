"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { getPrimaryWorkspaceId } from "@/lib/workspace"
import { getActiveAdAccountScope } from "@/lib/account-scope"
import { verifiedMetricCampaignWhere } from "@/lib/data-trust"

export type RevenueTrend = { date: string; revenue: number; spend: number }
export type ChannelBreakdown = { channel: string; roas: number; spend: number; conversions: number }

function round2(value: number) {
  return Number(value.toFixed(2))
}

function buildTrend(days = 30, campaigns: any[] = []) {
  const trendMap = new Map<string, { revenue: number; spend: number }>()
  for (let i = days; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    trendMap.set(dateStr, { revenue: 0, spend: 0 })
  }

  for (const campaign of campaigns) {
    const metricDate = campaign.lastSeenAt || campaign.createdAt || new Date()
    const dateStr = new Date(metricDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    const current = trendMap.get(dateStr)
    if (!current) continue

    current.revenue += Number(campaign.revenue || 0)
    current.spend += Number(campaign.spend || 0)
  }

  return Array.from(trendMap.entries()).map(([date, data]) => ({
    date,
    revenue: data.revenue,
    spend: data.spend,
  }))
}

export async function getAnalyticsOverview() {
  const session = await auth()
  if (!session?.user?.id) return null

  const userId = await resolveUserId(session.user.id)
  const workspaceId = await getPrimaryWorkspaceId(userId)
  const scope = await getActiveAdAccountScope(userId, workspaceId)
  if (!scope) {
    return {
      trend: [],
      channels: [],
      kpi: {
        revenue: { value: 0, change: 0 },
        spend: { value: 0, change: 0 },
        roas: { value: 0, change: 0 },
        conversionRate: { value: 0, change: 0 },
        cpa: { value: 0, change: 0 },
        totalClicks: 0,
        totalImpressions: 0,
        totalConversions: 0,
        activeCampaigns: 0,
        connectedPlatforms: 0,
        totalCampaigns: 0,
      },
      platformBreakdown: [],
      topCampaigns: [],
      bottomCampaigns: [],
      chartData: [],
      accountRequired: true,
    }
  }

  try {
    const [campaigns, integrations, leadsCount] = await Promise.all([
      prisma.campaign.findMany({
        where: verifiedMetricCampaignWhere({ userId, workspaceId, adAccountId: scope.adAccountId }),
        include: { integration: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.integration.findMany({
        where: { userId, workspaceId, selectedAdAccountId: scope.adAccountId },
      }),
      prisma.lead.count({
        where: {
          userId,
          workspaceId,
          adAccountId: scope.adAccountId,
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
    ])

    const trend = buildTrend(30, campaigns)
    const totalRevenue = campaigns.reduce((sum, c) => sum + Number(c.revenue || 0), 0)
    const totalSpend = campaigns.reduce((sum, c) => sum + Number(c.spend || 0), 0)
    const totalClicks = campaigns.reduce((sum, c) => sum + Number(c.clicks || 0), 0)
    const totalImpressions = campaigns.reduce((sum, c) => sum + Number(c.impressions || 0), 0)
    const totalConversions = campaigns.reduce((sum, c) => sum + Number(c.conversions || 0), 0)
    const roas = totalSpend > 0 ? round2(totalRevenue / totalSpend) : 0
    const ctr = totalImpressions > 0 ? round2((totalClicks / totalImpressions) * 100) : 0
    const activeCampaigns = campaigns.filter((c) => ["ACTIVE", "active"].includes(String(c.status))).length

    const platformMap: Record<string, { spend: number; revenue: number; count: number }> = {}
    for (const campaign of campaigns) {
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

    const sortedByRoas = [...campaigns]
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

    return {
      trend,
      channels: platformBreakdown.map((p) => ({
        channel: p.name,
        spend: p.spend,
        roas: p.roas,
        conversions: 0,
      })),
      kpi: {
        revenue: { value: totalRevenue, change: 0 },
        spend: { value: totalSpend, change: 0 },
        roas: { value: roas, change: 0 },
        conversionRate: { value: totalSpend > 0 ? round2((totalConversions / totalSpend) * 100) : 0, change: 0 },
        cpa: { value: totalConversions > 0 ? round2(totalSpend / totalConversions) : 0, change: 0 },
        totalClicks,
        totalImpressions,
        totalConversions,
        activeCampaigns,
        connectedPlatforms: integrations.filter((i) => i.selectedAdAccountId).length,
        totalCampaigns: campaigns.length,
      },
      platformBreakdown,
      topCampaigns,
      bottomCampaigns,
      chartData: trend,
    }
  } catch (error) {
    console.error("Analytics Action Error:", error)
    return null
  }
}

export async function getPlatformAnalytics(platformSlug: string) {
  const session = await auth()
  if (!session?.user?.id) return null
  const userId = await resolveUserId(session.user.id)
  const workspaceId = await getPrimaryWorkspaceId(userId)
  const scope = await getActiveAdAccountScope(userId, workspaceId)
  if (!scope) return null

  try {
    const normalized = platformSlug.toUpperCase()
    const campaigns = await prisma.campaign.findMany({
      where: {
        ...verifiedMetricCampaignWhere({ userId, workspaceId, adAccountId: scope.adAccountId }),
        platform: normalized as any,
      },
      orderBy: { createdAt: "desc" },
    })

    const totalSpend = campaigns.reduce((sum, c) => sum + Number(c.spend || 0), 0)
    const totalRevenue = campaigns.reduce((sum, c) => sum + Number(c.revenue || 0), 0)
    const roas = totalSpend > 0 ? round2(totalRevenue / totalSpend) : 0

    return {
      platformName: `${normalized.charAt(0)}${normalized.slice(1).toLowerCase()} Ads`,
      kpis: [
        { label: "Platform Spend", value: `$${totalSpend.toLocaleString()}`, change: "0%", icon: "DollarSign" },
        { label: "ROAS Index", value: `${roas}x`, change: "0.0", icon: "TrendingUp" },
        { label: "CPA Efficiency", value: "$0.00", change: "0%", icon: "Target" },
        { label: "Conversion Rate", value: "0.0%", change: "0%", icon: "Users" },
      ],
      campaigns: campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        roas: Number(c.roas || 0),
        spend: Number(c.spend || 0),
        revenue: Number(c.revenue || 0),
        status: c.status,
      })),
      hourly: Array.from({ length: 24 }, (_, i) => ({ hour: `${i}:00`, value: 0 })),
    }
  } catch (e) {
    console.error("Platform Analytics Error:", e)
    return null
  }
}
