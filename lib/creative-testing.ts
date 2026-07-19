// Creative testing discipline: which ad variant in an ad group is actually
// winning, and which ones show fatigue (CTR quietly declining over time).
// Mirrors the split-window trend approach already used for campaign-level
// trend detection (lib/ai-recommendation-engine.ts) so the two features
// reason about "decline" the same way across the app.

type AdMetricRow = { metricDate: Date; impressions: number; clicks: number; spend: number; conversions: number; revenue: number }

export type AdWithMetrics = {
  id: string
  externalId: string | null
  headlines: unknown
  descriptions: unknown
  status: string
  metricsDaily: AdMetricRow[]
}

export type CreativeAnalysis = {
  adId: string
  impressions: number
  clicks: number
  spend: number
  conversions: number
  revenue: number
  ctr: number
  roas: number | null
  isWinner: boolean
  fatigue: { isFatiguing: boolean; ctrChangePct: number | null }
}

const MIN_IMPRESSIONS_FOR_WINNER = 500
const MIN_IMPRESSIONS_PER_HALF_FOR_FATIGUE = 300
const FATIGUE_CTR_DROP_THRESHOLD = -25

function sum(rows: AdMetricRow[], key: "impressions" | "clicks" | "spend" | "conversions" | "revenue") {
  return rows.reduce((acc, r) => acc + (r[key] || 0), 0)
}

function detectFatigue(rows: AdMetricRow[]): { isFatiguing: boolean; ctrChangePct: number | null } {
  const sorted = [...rows].sort((a, b) => a.metricDate.getTime() - b.metricDate.getTime())
  if (sorted.length < 6) return { isFatiguing: false, ctrChangePct: null }
  const mid = Math.floor(sorted.length / 2)
  const early = sorted.slice(0, mid)
  const late = sorted.slice(mid)

  const earlyImpressions = sum(early, "impressions")
  const lateImpressions = sum(late, "impressions")
  if (earlyImpressions < MIN_IMPRESSIONS_PER_HALF_FOR_FATIGUE || lateImpressions < MIN_IMPRESSIONS_PER_HALF_FOR_FATIGUE) {
    return { isFatiguing: false, ctrChangePct: null }
  }

  const earlyCtr = sum(early, "clicks") / earlyImpressions
  const lateCtr = sum(late, "clicks") / lateImpressions
  if (earlyCtr <= 0) return { isFatiguing: false, ctrChangePct: null }

  const ctrChangePct = ((lateCtr - earlyCtr) / earlyCtr) * 100
  return { isFatiguing: ctrChangePct <= FATIGUE_CTR_DROP_THRESHOLD, ctrChangePct }
}

// Analyzes every ad within a single ad group together, since "winner" only
// makes sense relative to the other variants actually being tested against
// each other - not in isolation.
export function analyzeAdGroupCreatives(ads: AdWithMetrics[]): CreativeAnalysis[] {
  const analyzed = ads.map((ad) => {
    const impressions = sum(ad.metricsDaily, "impressions")
    const clicks = sum(ad.metricsDaily, "clicks")
    const spend = sum(ad.metricsDaily, "spend")
    const conversions = sum(ad.metricsDaily, "conversions")
    const revenue = sum(ad.metricsDaily, "revenue")
    const ctr = impressions > 0 ? clicks / impressions : 0
    const roas = spend > 0 && revenue > 0 ? revenue / spend : null

    return {
      adId: ad.id,
      impressions,
      clicks,
      spend,
      conversions,
      revenue,
      ctr,
      roas,
      isWinner: false,
      fatigue: detectFatigue(ad.metricsDaily),
    }
  })

  const eligible = analyzed.filter((a) => a.impressions >= MIN_IMPRESSIONS_FOR_WINNER)
  if (eligible.length >= 2) {
    const best = eligible.reduce((a, b) => (b.ctr > a.ctr ? b : a))
    const bestEntry = analyzed.find((a) => a.adId === best.adId)
    if (bestEntry) bestEntry.isWinner = true
  }

  return analyzed
}
