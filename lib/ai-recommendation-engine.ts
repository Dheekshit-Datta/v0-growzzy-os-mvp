import { prisma } from "@/lib/prisma"
import { verifiedMetricCampaignWhere } from "@/lib/data-trust"
import { runAutopilotForWorkspace } from "@/lib/autopilot"

export interface AIRecommendation {
  id: string
  title: string
  description: string
  action: "pause" | "increase_budget" | "refresh_creative" | "improve_ctr" | "declining_trend" | "tracking_integrity"
  impact: "high" | "medium" | "low"
  campaignId: string | null
  platform: "GOOGLE" | "META"
  estimatedImprovement: string
  confidence: number
  riskLevel: "LOW" | "MEDIUM" | "HIGH"
  currentBudget: number | null
  recommendedBudget: number | null
  metrics: {
    spend: number
    clicks: number
    impressions: number
    conversions: number
    ctr: number
    roas: number
    cpa: number
  }
}

// Maps engine actions to real Google Ads mutation types the launch/apply
// pipeline already knows how to execute (see lib/services/google-publish.ts
// and app/api/ai/apply-optimization). "improve_ctr" and "declining_trend"
// have no direct platform mutation - Google Ads has no single-click
// "tighten targeting" or "investigate this trend" action - so they stay
// advisory-only (dismissable, not applyable).
const ACTION_TYPE_MAP: Record<AIRecommendation["action"], string | null> = {
  pause: "PAUSE",
  increase_budget: "BUDGET_INCREASE",
  refresh_creative: "CREATIVE_REFRESH",
  improve_ctr: null,
  declining_trend: null,
  tracking_integrity: null,
}

// Meaningful spend with zero recorded conversions account-wide is the
// single most common thing that silently wrecks a self-serve ad account -
// every ROAS/CPA number the rest of this engine reasons about is garbage
// if conversion tracking isn't actually firing. Checked at account level
// (not per-campaign) using data already synced - no extra Google API call.
const TRACKING_INTEGRITY_SPEND_FLOOR = 75

function safeMetric(value: number | null | undefined) {
  return Number(value || 0)
}

type RiskLevel = "CONSERVATIVE" | "BALANCED" | "AGGRESSIVE"

// Thresholds scale with the user's own stated risk tolerance
// (UserSettings.riskLevel) instead of one-size-fits-all numbers - a
// conservative user needs more evidence before we flag a pause; an
// aggressive one wants to act sooner.
function thresholdsForRisk(riskLevel: RiskLevel) {
  switch (riskLevel) {
    case "CONSERVATIVE":
      return { pauseSpend: 150, roasScaleMultiplier: 1.3, poorRoasCeiling: 1.2, ctrFloor: 0.8 }
    case "AGGRESSIVE":
      return { pauseSpend: 60, roasScaleMultiplier: 0.85, poorRoasCeiling: 1.8, ctrFloor: 1.2 }
    case "BALANCED":
    default:
      return { pauseSpend: 100, roasScaleMultiplier: 1, poorRoasCeiling: 1.5, ctrFloor: 1 }
  }
}

export async function generateAIRecommendations(input: {
  userId: string
  workspaceId: string
  adAccountId?: string | null
}): Promise<AIRecommendation[]> {
  const [campaigns, userSettings, workspace] = await Promise.all([
    prisma.campaign.findMany({
      where: {
        ...verifiedMetricCampaignWhere({ userId: input.userId, workspaceId: input.workspaceId }),
        ...(input.adAccountId ? { adAccountId: input.adAccountId } : {}),
      },
      select: {
        id: true, name: true, platform: true,
        spend: true, totalSpend: true, revenue: true, totalRevenue: true,
        conversions: true, totalConversions: true, clicks: true, impressions: true,
        ctr: true, cpa: true, roas: true, budgetAmount: true, dailyBudget: true,
      },
      orderBy: { spend: "desc" },
      take: 30,
    }),
    prisma.userSettings.findUnique({ where: { userId: input.userId } }),
    prisma.workspace.findUnique({
      where: { id: input.workspaceId },
      select: { id: true },
    }).catch(() => null),
  ])

  if (!campaigns.length) return []

  const riskLevel = (userSettings?.riskLevel as RiskLevel) || "BALANCED"
  const { pauseSpend, roasScaleMultiplier, poorRoasCeiling, ctrFloor } = thresholdsForRisk(riskLevel)
  const targetRoas = userSettings?.targetRoas || (userSettings?.primaryKpi === "ROAS" ? userSettings?.kpiTarget : null) || 3.5
  const targetCpa = (userSettings?.primaryKpi === "CPA" ? userSettings?.kpiTarget : null) || null
  const budgetShiftPct = 0.2
  const budgetCeiling = null
  const scaleRoasThreshold = targetRoas * roasScaleMultiplier

  // Trend: last 14 days of daily metrics per campaign, split into two
  // 7-day halves, so a campaign that's quietly declining gets flagged
  // before it's expensive enough to hit the hard pause threshold - a
  // point-in-time snapshot alone can't see this.
  const campaignIds = campaigns.map((c) => c.id)
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
  const dailyMetrics = campaignIds.length
    ? await prisma.campaignMetricDaily.findMany({
        where: { campaignId: { in: campaignIds }, metricDate: { gte: fourteenDaysAgo } },
        select: { campaignId: true, metricDate: true, spend: true, revenue: true, clicks: true, impressions: true },
        orderBy: { metricDate: "asc" },
      })
    : []
  const metricsByCampaign = new Map<string, typeof dailyMetrics>()
  for (const m of dailyMetrics) {
    const list = metricsByCampaign.get(m.campaignId) || []
    list.push(m)
    metricsByCampaign.set(m.campaignId, list)
  }

  function trendRoasChange(campaignId: string): { pctChange: number; recentRoas: number; priorRoas: number } | null {
    const rows = metricsByCampaign.get(campaignId)
    if (!rows || rows.length < 6) return null
    const mid = Math.floor(rows.length / 2)
    const prior = rows.slice(0, mid)
    const recent = rows.slice(mid)
    const sum = (list: typeof rows, key: "spend" | "revenue") => list.reduce((s, r) => s + Number(r[key] || 0), 0)
    const priorSpend = sum(prior, "spend")
    const recentSpend = sum(recent, "spend")
    if (priorSpend < 10 || recentSpend < 10) return null
    const priorRoas = sum(prior, "revenue") / priorSpend
    const recentRoas = sum(recent, "revenue") / recentSpend
    if (priorRoas <= 0) return null
    const pctChange = ((recentRoas - priorRoas) / priorRoas) * 100
    return { pctChange, recentRoas, priorRoas }
  }

  const recommendations: AIRecommendation[] = []

  const accountSpend = campaigns.reduce((sum, c) => sum + safeMetric(c.spend || c.totalSpend), 0)
  const accountConversions = campaigns.reduce((sum, c) => sum + safeMetric(c.conversions || c.totalConversions), 0)
  if (accountSpend >= TRACKING_INTEGRITY_SPEND_FLOOR && accountConversions === 0) {
    recommendations.push({
      id: `rec_tracking_${input.workspaceId}`,
      title: "Your conversion tracking may not be working",
      description: `You've spent $${accountSpend.toFixed(2)} across ${campaigns.length} campaign${campaigns.length === 1 ? "" : "s"} with 0 conversions recorded anywhere. This usually means the tracking tag isn't firing correctly, not that the campaigns are failing - verify your conversion tracking setup in Google Ads before trusting any ROAS or CPA numbers here.`,
      action: "tracking_integrity",
      impact: "high",
      campaignId: null,
      platform: "GOOGLE",
      estimatedImprovement: "Every optimization decision below is unreliable until this is fixed",
      confidence: 90,
      riskLevel: "LOW",
      currentBudget: null,
      recommendedBudget: null,
      metrics: { spend: accountSpend, clicks: 0, impressions: 0, conversions: 0, ctr: 0, roas: 0, cpa: 0 },
    })
  }

  for (const campaign of campaigns) {
    const spend = safeMetric(campaign.spend || campaign.totalSpend)
    const clicks = safeMetric(campaign.clicks)
    const impressions = safeMetric(campaign.impressions)
    const conversions = safeMetric(campaign.conversions || campaign.totalConversions)
    const ctr = safeMetric(campaign.ctr || (impressions > 0 ? (clicks / impressions) * 100 : 0))
    const roas = safeMetric(campaign.roas || (spend > 0 ? safeMetric(campaign.revenue || campaign.totalRevenue) / spend : 0))
    const cpa = safeMetric(campaign.cpa || (conversions > 0 ? spend / conversions : 0))
    const currentBudget = campaign.dailyBudget ?? campaign.budgetAmount ?? null
    const metrics = { spend, clicks, impressions, conversions, ctr, roas, cpa }

    if (spend >= pauseSpend && conversions === 0) {
      recommendations.push({
        id: `rec_pause_${campaign.id}`,
        title: `Pause ${campaign.name}`,
        description: `${campaign.name} spent $${spend.toFixed(2)} with 0 conversions. Pause and reallocate budget.`,
        action: "pause",
        impact: "high",
        campaignId: campaign.id,
        platform: campaign.platform as "GOOGLE" | "META",
        estimatedImprovement: `Prevent ~$${spend.toFixed(0)} further waste this cycle`,
        confidence: 92,
        riskLevel: "LOW",
        currentBudget,
        recommendedBudget: null,
        metrics,
      })
      continue
    }

    if (roas >= scaleRoasThreshold && spend >= 25) {
      const rawTarget = currentBudget ? currentBudget * (1 + budgetShiftPct) : null
      const recommendedBudget = rawTarget && budgetCeiling ? Math.min(rawTarget, budgetCeiling) : rawTarget
      const shiftLabel = Math.round(budgetShiftPct * 100)
      recommendations.push({
        id: `rec_scale_${campaign.id}`,
        title: `Scale ${campaign.name} budget`,
        description: `${campaign.name} is at ${roas.toFixed(2)}x ROAS on $${spend.toFixed(2)} spend, above your ${targetRoas.toFixed(1)}x target. Increase budget by up to ${shiftLabel}%${budgetCeiling ? ` (capped at your $${budgetCeiling}/day ceiling)` : ""}.`,
        action: "increase_budget",
        impact: "high",
        campaignId: campaign.id,
        platform: campaign.platform as "GOOGLE" | "META",
        estimatedImprovement: "Potential +15-25% revenue growth",
        confidence: 84,
        riskLevel: "MEDIUM",
        currentBudget,
        recommendedBudget,
        metrics,
      })
      continue
    }

    if (ctr < ctrFloor && impressions >= 1000) {
      recommendations.push({
        id: `rec_creative_${campaign.id}`,
        title: `Refresh creative for ${campaign.name}`,
        description: `${campaign.name} CTR is ${ctr.toFixed(2)}% across ${impressions.toFixed(0)} impressions. Test new creative angles.`,
        action: "refresh_creative",
        impact: "medium",
        campaignId: campaign.id,
        platform: campaign.platform as "GOOGLE" | "META",
        estimatedImprovement: "Potential +10-20% CTR lift",
        confidence: 78,
        riskLevel: "LOW",
        currentBudget,
        recommendedBudget: null,
        metrics,
      })
      continue
    }

    const cpaOverTarget = targetCpa && cpa > 0 && cpa > targetCpa
    if ((spend >= 50 && roas > 0 && roas < poorRoasCeiling) || (spend >= 50 && cpaOverTarget)) {
      recommendations.push({
        id: `rec_ctr_${campaign.id}`,
        title: `Tighten targeting in ${campaign.name}`,
        description: cpaOverTarget
          ? `${campaign.name} CPA is $${cpa.toFixed(2)}, above your $${targetCpa!.toFixed(2)} target. Improve targeting and query quality.`
          : `${campaign.name} ROAS is ${roas.toFixed(2)}x with CPA $${cpa.toFixed(2)}. Improve targeting and query quality.`,
        action: "improve_ctr",
        impact: "medium",
        campaignId: campaign.id,
        platform: campaign.platform as "GOOGLE" | "META",
        estimatedImprovement: "Potential +8-15% efficiency",
        confidence: 72,
        riskLevel: "MEDIUM",
        currentBudget,
        recommendedBudget: null,
        metrics,
      })
      continue
    }

    // Trend check runs last and only if nothing else already fired for this
    // campaign - catches quiet decline before it crosses a hard threshold.
    const trend = trendRoasChange(campaign.id)
    if (trend && trend.pctChange <= -25) {
      recommendations.push({
        id: `rec_trend_${campaign.id}`,
        title: `${campaign.name} performance is declining`,
        description: `ROAS dropped from ${trend.priorRoas.toFixed(2)}x to ${trend.recentRoas.toFixed(2)}x over the last 7 days (${trend.pctChange.toFixed(0)}%). Worth a look before it hits your pause threshold.`,
        action: "declining_trend",
        impact: "medium",
        campaignId: campaign.id,
        platform: campaign.platform as "GOOGLE" | "META",
        estimatedImprovement: "Catch it before it becomes a pause-worthy loss",
        confidence: 68,
        riskLevel: "LOW",
        currentBudget,
        recommendedBudget: null,
        metrics,
      })
    }
  }

  return recommendations.slice(0, 12)
}

// Generates recommendations and persists them as real OptimizationSuggestion
// rows so the Recommendations tab and Apply flow have something to read.
// Called after a successful sync (lib/sync-engine.ts) and from the manual
// "Refresh recommendations" button (POST /api/ai/recommendations/generate).
export async function generateAndPersistRecommendations(input: {
  userId: string
  workspaceId: string
  adAccountId?: string | null
}) {
  const recommendations = await generateAIRecommendations(input)
  if (!recommendations.length) return []

  const campaignIds = recommendations.map((r) => r.campaignId).filter((id): id is string => id != null)

  // Clear this account's own stale, un-actioned suggestions for these
  // campaigns before writing fresh ones, so re-running generation doesn't
  // pile up duplicates every sync. Applied/dismissed suggestions are left
  // alone - they're history, not live recommendations. Account-level
  // insights (campaignId null, e.g. tracking_integrity) are deduped
  // separately by insightType since they have no campaignId to key on.
  await prisma.optimizationSuggestion.deleteMany({
    where: {
      workspaceId: input.workspaceId,
      applied: false,
      dismissed: false,
      OR: [
        { campaignId: { in: campaignIds } },
        { campaignId: null, insightType: "tracking_integrity" },
      ],
    },
  })

  const created = await prisma.$transaction(
    recommendations.map((r) =>
      prisma.optimizationSuggestion.create({
        data: {
          workspaceId: input.workspaceId,
          userId: input.userId,
          campaignId: r.campaignId,
          actionType: ACTION_TYPE_MAP[r.action],
          recommendedValue: r.recommendedBudget != null ? String(Math.round(r.recommendedBudget * 100) / 100) : null,
          sourceEntityId: r.campaignId,
          sourceType: "Campaign",
          insightType: r.action,
          title: r.title,
          message: r.description,
          confidence: r.confidence,
          projectedImpact: { estimatedImprovement: r.estimatedImprovement, impact: r.impact },
          evidence: r.metrics,
        },
      })
    )
  )

  // Only executes anything for workspaces that explicitly opted into
  // Full Autopilot mode - no-ops immediately otherwise. See lib/autopilot.ts
  // for the exact (deliberately narrow) safety boundaries.
  await runAutopilotForWorkspace({ userId: input.userId, workspaceId: input.workspaceId }).catch(() => {})

  return created
}
