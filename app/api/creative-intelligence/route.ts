import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId } from "@/lib/workspace"
import { verifiedMetricCampaignWhere } from "@/lib/data-trust"
import { buildDailyBriefFromCampaigns } from "@/lib/daily-brief"
import { getActiveAdAccountScope } from "@/lib/account-scope"

export const dynamic = "force-dynamic"

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : []
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = await resolveUserId(session.user.id)
  const workspaceId = await getRequestWorkspaceId(userId, req)
  const requestedAdAccountId = req.nextUrl.searchParams.get("adAccountId")
  const scope = await getActiveAdAccountScope(userId, workspaceId, requestedAdAccountId)
  if (!scope) {
    return NextResponse.json({
      ok: true,
      workspaceId,
      aiGenerations: [],
      fatigueAlerts: [],
      scoreLeaders: [],
      hookStats: [],
      trust: {
        source: "No selected ad account. Creative intelligence is account-scoped to prevent cross-client leakage.",
        accountRequired: true,
      },
    })
  }

  const [creatives, campaigns] = await Promise.all([
    prisma.generatedCreative.findMany({
      where: {
        userId,
        workspaceId,
        adAccountId: scope.adAccountId,
      },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
    prisma.campaign.findMany({
      where: verifiedMetricCampaignWhere({ userId, workspaceId, adAccountId: scope.adAccountId }),
      include: { metricsDaily: { orderBy: { metricDate: "desc" }, take: 14 } },
      take: 500,
    }),
  ])
  const campaignMap = new Map(
    campaigns.map((campaign) => [campaign.id, { id: campaign.id, name: campaign.name, platform: campaign.platform }])
  )

  const brief = buildDailyBriefFromCampaigns(campaigns)
  const hookCounts = new Map<string, number>()
  for (const creative of creatives) {
    for (const variation of asArray(creative.variations)) {
      const angle = String(variation?.angle || variation?.hook || "unknown").toLowerCase()
      hookCounts.set(angle, (hookCounts.get(angle) || 0) + 1)
    }
  }

  return NextResponse.json({
    ok: true,
    workspaceId,
    adAccountId: scope.adAccountId,
    aiGenerations: creatives.map((creative) => ({
      id: creative.id,
      campaignId: creative.campaignId,
      campaign: creative.campaignId ? campaignMap.get(creative.campaignId) || null : null,
      brief: creative.brief,
      imageUrls: creative.imageUrls,
      assets: creative.assets,
      selectedIndex: creative.selectedIndex,
      selectedVariation: asArray(creative.variations)[creative.selectedIndex || 0] || null,
      variations: creative.variations,
      score: creative.score,
      scoreBreakdown: creative.scoreBreakdown,
      isPushed: creative.isPushed,
      pushedAt: creative.pushedAt,
      ctr: creative.ctr,
      roas: creative.roas,
      impressions: creative.impressions,
      clicks: creative.clicks,
      createdAt: creative.createdAt,
    })),
    fatigueAlerts: brief.creativeFatigueAlerts,
    scoreLeaders: creatives.slice(0, 10).map((creative) => ({
      id: creative.id,
      score: creative.score,
      headline: asArray(creative.variations)[creative.selectedIndex || 0]?.headline,
      campaignName: creative.campaignId ? campaignMap.get(creative.campaignId)?.name || null : null,
    })),
    hookStats: Array.from(hookCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([hook, count]) => ({ hook, count })),
    trust: {
      source: "Saved GROWZZY creative records and verified campaign metrics only",
      imageGenerationMayBeDisabled: true,
    },
  })
}
