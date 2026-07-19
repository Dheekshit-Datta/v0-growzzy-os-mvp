import { prisma } from "@/lib/prisma"
import { verifiedMetricCampaignWhere } from "@/lib/data-trust"

export interface AIRecommendation {
  id: string
  title: string
  description: string
  action: "pause" | "increase_budget" | "refresh_creative" | "improve_ctr"
  impact: "high" | "medium" | "low"
  campaignId: string
  platform: "GOOGLE" | "META"
  estimatedImprovement: string
  confidence: number
  riskLevel: "LOW" | "MEDIUM" | "HIGH"
  currentBudget: number | null
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
// and app/api/ai/apply-optimization). "improve_ctr" has no direct platform
// mutation - Google Ads has no single-click "tighten targeting" action - so
// it stays advisory-only (dismissable, not applyable).
const ACTION_TYPE_MAP: Record<AIRecommendation["action"], string | null> = {
  pause: "PAUSE",
  increase_budget: "BUDGET_INCREASE",
  refresh_creative: "CREATIVE_REFRESH",
  improve_ctr: null,
}

function safeMetric(value: number | null | undefined) {
  return Number(value || 0)
}

export async function generateAIRecommendations(input: {
  userId: string
  workspaceId: string
  adAccountId?: string | null
}): Promise<AIRecommendation[]> {
  const campaigns = await prisma.campaign.findMany({
    where: {
      ...verifiedMetricCampaignWhere({
        userId: input.userId,
        workspaceId: input.workspaceId,
      }),
      ...(input.adAccountId ? { adAccountId: input.adAccountId } : {}),
    },
    select: {
      id: true,
      name: true,
      platform: true,
      spend: true,
      totalSpend: true,
      revenue: true,
      totalRevenue: true,
      conversions: true,
      totalConversions: true,
      clicks: true,
      impressions: true,
      ctr: true,
      cpa: true,
      roas: true,
      budgetAmount: true,
      dailyBudget: true,
    },
    orderBy: { spend: "desc" },
    take: 30,
  })

  if (!campaigns.length) return []

  const recommendations: AIRecommendation[] = []

  for (const campaign of campaigns) {
    const spend = safeMetric(campaign.spend || campaign.totalSpend)
    const clicks = safeMetric(campaign.clicks)
    const impressions = safeMetric(campaign.impressions)
    const conversions = safeMetric(campaign.conversions || campaign.totalConversions)
    const ctr = safeMetric(campaign.ctr || (impressions > 0 ? (clicks / impressions) * 100 : 0))
    const roas = safeMetric(campaign.roas || (spend > 0 ? safeMetric(campaign.revenue || campaign.totalRevenue) / spend : 0))
    const cpa = safeMetric(campaign.cpa || (conversions > 0 ? spend / conversions : 0))
    const currentBudget = campaign.dailyBudget ?? campaign.budgetAmount ?? null

    if (spend >= 100 && conversions === 0) {
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
        metrics: { spend, clicks, impressions, conversions, ctr, roas, cpa },
      })
      continue
    }

    if (roas >= 3.5 && spend >= 25) {
      recommendations.push({
        id: `rec_scale_${campaign.id}`,
        title: `Scale ${campaign.name} budget`,
        description: `${campaign.name} is at ${roas.toFixed(2)}x ROAS on $${spend.toFixed(2)} spend. Increase budget by up to 20%.`,
        action: "increase_budget",
        impact: "high",
        campaignId: campaign.id,
        platform: campaign.platform as "GOOGLE" | "META",
        estimatedImprovement: "Potential +15-25% revenue growth",
        confidence: 84,
        riskLevel: "MEDIUM",
        currentBudget,
        metrics: { spend, clicks, impressions, conversions, ctr, roas, cpa },
      })
      continue
    }

    if (ctr < 1 && impressions >= 1000) {
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
        metrics: { spend, clicks, impressions, conversions, ctr, roas, cpa },
      })
      continue
    }

    if (spend >= 50 && roas > 0 && roas < 1.5) {
      recommendations.push({
        id: `rec_ctr_${campaign.id}`,
        title: `Tighten targeting in ${campaign.name}`,
        description: `${campaign.name} ROAS is ${roas.toFixed(2)}x with CPA $${cpa.toFixed(2)}. Improve targeting and query quality.`,
        action: "improve_ctr",
        impact: "medium",
        campaignId: campaign.id,
        platform: campaign.platform as "GOOGLE" | "META",
        estimatedImprovement: "Potential +8-15% efficiency",
        confidence: 72,
        riskLevel: "MEDIUM",
        currentBudget,
        metrics: { spend, clicks, impressions, conversions, ctr, roas, cpa },
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

  const campaignIds = recommendations.map((r) => r.campaignId)

  // Clear this account's own stale, un-actioned suggestions for these
  // campaigns before writing fresh ones, so re-running generation doesn't
  // pile up duplicates every sync. Applied/dismissed suggestions are left
  // alone - they're history, not live recommendations.
  await prisma.optimizationSuggestion.deleteMany({
    where: {
      workspaceId: input.workspaceId,
      campaignId: { in: campaignIds },
      applied: false,
      dismissed: false,
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
          recommendedValue:
            r.action === "increase_budget" && r.currentBudget
              ? String(Math.round(r.currentBudget * 1.2 * 100) / 100)
              : null,
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

  return created
}
