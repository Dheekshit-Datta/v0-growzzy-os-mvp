import type { Campaign, CampaignMetricDaily } from "@prisma/client"
import {
  analyzeCampaigns,
  buildRuleRecommendations,
  calculateAccountAverages,
  calculateAuditScores,
  type RuleRecommendation,
} from "@/lib/marketing-logic"

type CampaignWithMetrics = Pick<
  Campaign,
  | "id"
  | "externalId"
  | "name"
  | "status"
  | "platform"
  | "spend"
  | "budgetAmount"
  | "impressions"
  | "clicks"
  | "conversions"
  | "revenue"
  | "ctr"
  | "cpc"
  | "cpa"
  | "roas"
  | "hasCreative"
> & {
  metricsDaily?: Pick<CampaignMetricDaily, "metricDate" | "spend" | "clicks" | "impressions" | "conversions" | "revenue" | "ctr" | "roas" | "cpa">[]
}

function money(value: number) {
  return `$${Math.round(value || 0).toLocaleString("en-US")}`
}

function roas(value: number) {
  return `${Number(value || 0).toFixed(2)}x`
}

function pct(value: number) {
  return `${Number(value || 0).toFixed(2)}%`
}

function weeklySpend(campaign: CampaignWithMetrics) {
  const rows = campaign.metricsDaily || []
  if (!rows.length) return Number(campaign.spend || 0)
  return rows.reduce((sum, row) => sum + Number(row.spend || 0), 0)
}

function ctrWindow(campaign: CampaignWithMetrics, days: number) {
  const rows = [...(campaign.metricsDaily || [])]
    .sort((a, b) => Number(b.metricDate) - Number(a.metricDate))
    .slice(0, days)
  const impressions = rows.reduce((sum, row) => sum + Number(row.impressions || 0), 0)
  const clicks = rows.reduce((sum, row) => sum + Number(row.clicks || 0), 0)
  return impressions > 0 ? (clicks / impressions) * 100 : 0
}

export function buildDailyBriefFromCampaigns(campaigns: CampaignWithMetrics[]) {
  const averages = calculateAccountAverages(campaigns)
  const analyzed = analyzeCampaigns(campaigns, averages)
  const scoreData = calculateAuditScores(campaigns, averages)
  const recommendations = buildRuleRecommendations(campaigns, averages).map((rec) => enrichRecommendation(rec, campaigns))

  const zeroConversionWasteCampaigns = campaigns
    .map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      spend: weeklySpend(campaign),
      conversions: Number(campaign.conversions || 0),
      roas: Number(campaign.roas || 0),
    }))
    .filter((campaign) => campaign.spend > 0 && campaign.conversions === 0)
    .sort((a, b) => b.spend - a.spend)

  const moneyWastedAmount = zeroConversionWasteCampaigns.reduce((sum, campaign) => sum + campaign.spend, 0)

  const creativeFatigueAlerts = campaigns
    .map((campaign) => {
      const ctr3d = ctrWindow(campaign, 3)
      const ctr7d = ctrWindow(campaign, 7)
      const declinePct = ctr7d > 0 && ctr3d < ctr7d ? ((ctr7d - ctr3d) / ctr7d) * 100 : 0
      return {
        campaignId: campaign.id,
        campaignName: campaign.name,
        ctr3d,
        ctr7d,
        declinePct: Number(declinePct.toFixed(1)),
        ctaHref: `/dashboard/creatives/generate?campaignId=${campaign.id}`,
      }
    })
    .filter((alert) => alert.declinePct >= 20)
    .sort((a, b) => b.declinePct - a.declinePct)
    .slice(0, 3)

  const scaleReady = analyzed
    .filter((campaign) => campaign.scaleScore >= 55)
    .sort((a, b) => b.scaleScore - a.scaleScore)
    .slice(0, 3)
    .map((campaign) => ({
      campaignId: campaign.id,
      campaignName: campaign.name,
      roas: Number(campaign.roas || 0),
      spend: Number(campaign.spend || 0),
      reason: `${campaign.name} is producing ${roas(Number(campaign.roas || 0))} ROAS against account average ${roas(averages.avgRoas)}.`,
    }))

  const topActions = recommendations.slice(0, 5)
  const summary = campaigns.length
    ? `Your AI media buyer found ${topActions.length} actions across ${campaigns.length} Google campaigns. ${money(moneyWastedAmount)} was spent this week on campaigns with zero conversions, and account health is ${scoreData.overallScore}/100.`
    : "Connect Google Ads and sync campaigns to unlock your daily AI media buyer brief."

  return {
    summary,
    accountHealth: {
      overallScore: scoreData.overallScore,
      scores: scoreData.scores,
      campaignCount: campaigns.length,
      totalSpend: averages.totalSpend,
      avgRoas: averages.avgRoas,
      avgCpa: averages.avgCpa,
      topIssue:
        moneyWastedAmount > 0
          ? `${money(moneyWastedAmount)} spent on campaigns with zero conversions`
          : creativeFatigueAlerts[0]
            ? `Creative fatigue in ${creativeFatigueAlerts[0].campaignName}`
            : scaleReady[0]
              ? `${scaleReady[0].campaignName} is ready to scale`
              : null,
    },
    moneyWasted: {
      amount: Number(moneyWastedAmount.toFixed(2)),
      label: money(moneyWastedAmount),
      campaigns: zeroConversionWasteCampaigns.slice(0, 5),
    },
    creativeFatigueAlerts,
    scaleReady,
    recommendations: topActions,
  }
}

export function enrichRecommendation(rec: RuleRecommendation, campaigns: CampaignWithMetrics[]) {
  const campaign = campaigns.find((item) => item.id === rec.campaignId)
  const spend = Number(campaign?.spend || 0)
  const cpa = Number(campaign?.cpa || 0)
  const cpc = Number(campaign?.cpc || 0)
  const ctr = Number(campaign?.ctr || 0)
  const campaignRoas = Number(campaign?.roas || 0)
  const conversions = Number(campaign?.conversions || 0)
  const riskLevel = rec.type === "PAUSE" ? "HIGH" : rec.type.includes("BUDGET") ? "MEDIUM" : "LOW"
  const safeActionPayload = {
    type: rec.type,
    campaignId: rec.campaignId,
    externalId: rec.externalId,
    recommendedValue: rec.recommendedValue,
    previousValue: rec.currentValue,
  }

  return {
    ...rec,
    spend,
    cpa,
    cpc,
    ctr,
    roas: campaignRoas,
    conversions,
    riskLevel,
    safeActionPayload,
    evidence: {
      spend: money(spend),
      cpa: cpa ? money(cpa) : "N/A",
      cpc: cpc ? money(cpc) : "N/A",
      ctr: pct(ctr),
      roas: roas(campaignRoas),
      conversions,
    },
  }
}
