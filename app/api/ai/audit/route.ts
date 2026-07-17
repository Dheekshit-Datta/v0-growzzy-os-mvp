import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import OpenAI from "openai"
import { auth } from "@/lib/auth"
import { resolveUserId } from "@/lib/resolve-user"
import { prisma } from "@/lib/prisma"
import {
  analyzeCampaigns,
  buildRuleRecommendations,
  calculateAccountAverages,
  calculateAuditScores,
} from "@/lib/marketing-logic"
import { getRequestWorkspaceId } from "@/lib/workspace"
import { enrichRecommendation } from "@/lib/daily-brief"
import { recordActivity } from "@/lib/activity-log"
import { verifiedMetricCampaignWhere } from "@/lib/data-trust"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" })

function safeJsonObject(raw: string | null | undefined, fallback: any) {
  if (!raw) return fallback
  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    const userId = await resolveUserId(session.user.id)
    const workspaceId = await getRequestWorkspaceId(userId, req)
    const settings = await prisma.userSettings.upsert({
      where: { userId },
      update: {},
      create: { userId, primaryKpi: "ROAS", riskLevel: "BALANCED" },
    })
    const googleIntegration = await prisma.integration.findFirst({
      where: { userId, workspaceId, platform: "GOOGLE", hasAdsAccess: true, status: { in: ["OAUTH_GRANTED", "ACCOUNT_SELECTED", "INITIAL_SYNC_RUNNING", "ACTIVE", "SYNC_FAILED"] } },
      select: { id: true, selectedAdAccountId: true, accountId: true },
    })
    const selectedAdAccountId = googleIntegration?.selectedAdAccountId || googleIntegration?.accountId || null
    if (!googleIntegration || !selectedAdAccountId) {
      return NextResponse.json(
        { success: false, ok: false, error: "Connect Google Ads and select an ad account before running an audit.", code: "NO_SELECTED_AD_ACCOUNT" },
        { status: 409 }
      )
    }

    const campaigns = await prisma.campaign.findMany({
      where: verifiedMetricCampaignWhere({
        userId,
        workspaceId,
        platform: "GOOGLE",
        integrationId: googleIntegration.id,
        adAccountId: selectedAdAccountId,
      }),
      select: {
        id: true,
        externalId: true,
        name: true,
        platform: true,
        spend: true,
        cpc: true,
        cpa: true,
        ctr: true,
        roas: true,
        conversions: true,
        clicks: true,
        impressions: true,
        status: true,
        budgetAmount: true,
        revenue: true,
        hasCreative: true,
      },
      orderBy: { spend: "desc" },
    })

    if (!campaigns.length) {
      return NextResponse.json(
        {
          success: false,
          ok: false,
          error: "Connect Google Ads and sync campaigns to run an audit.",
          code: "NO_CAMPAIGN_DATA",
        },
        { status: 409 }
      )
    }

    const averages = calculateAccountAverages(campaigns)
    const analyzedCampaigns = analyzeCampaigns(campaigns, averages)
    const ruleRecommendations = buildRuleRecommendations(campaigns, averages).map((rec) => enrichRecommendation(rec, campaigns))
    const scoreData = calculateAuditScores(campaigns, averages)
    const deterministicSummary = `Audited ${campaigns.length} Google campaigns with ${averages.avgRoas.toFixed(2)}x average ROAS, $${averages.avgCpc.toFixed(2)} CPC, ${averages.avgCtr.toFixed(2)}% CTR, and $${averages.totalSpend.toFixed(2)} spend. Found ${ruleRecommendations.length} rule-backed optimization opportunities from real synced data.`
    let auditData = {
      ...scoreData,
      summary: deterministicSummary,
      totalPotentialImpact: ruleRecommendations.reduce((sum, rec) => sum + Number(rec.potentialRevenueImpact || 0), 0),
      recommendations: ruleRecommendations,
    }

    if (process.env.OPENAI_API_KEY && campaigns.length) {
      const confidenceThreshold = settings.riskLevel === "CONSERVATIVE" ? 85 : settings.riskLevel === "BALANCED" ? 70 : 0
      const auditPrompt = `You are an elite Google Ads account auditor with 15 years experience managing $500M+ in ad spend.

ACCOUNT SUMMARY:
Total campaigns: ${campaigns.length}
Total spend (30 days): $${averages.totalSpend.toFixed(2)}
Account avg ROAS: ${averages.avgRoas.toFixed(2)}x
Account avg CPC: $${averages.avgCpc.toFixed(2)}
Account avg CTR: ${averages.avgCtr.toFixed(2)}%
Account avg CPA: $${averages.avgCpa.toFixed(2)}
Account avg conversion rate: ${averages.avgConversionRate.toFixed(2)}%
User KPI: ${settings.primaryKpi}, risk level: ${settings.riskLevel}, confidence threshold: ${confidenceThreshold}

INDUSTRY BENCHMARKS:
Search CTR: 3.17% | Display CTR: 0.46% | Avg CVR: 3.75% | Avg CPC $2.69

CAMPAIGN DATA WITH PRE-CALCULATED FLAGS:
${JSON.stringify(analyzedCampaigns, null, 2)}

DETERMINISTIC RECOMMENDATION BASELINE:
${JSON.stringify(ruleRecommendations, null, 2)}

Return ONLY valid JSON in this exact format:
{
  "overallScore": 0,
  "scores": {"budgetEfficiency":0,"creativeHealth":0,"biddingStrategy":0,"campaignStructure":0},
  "summary": "specific 2-3 sentence summary",
  "totalPotentialImpact": 0,
  "recommendations": [
    {"id":"rec_1","priority":"HIGH","type":"BUDGET_INCREASE","campaignId":"campaign DB id","campaignName":"exact campaign name","externalId":"external id","title":"max 8 words","reasoning":"specific numbers","currentValue":"current","recommendedValue":"recommended","expectedImpact":"specific improvement","potentialRevenueImpact":0,"confidence":80}
  ]
}`
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_AUDIT_MODEL || "gpt-4o",
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: auditPrompt }],
      })
      const parsed = safeJsonObject(completion.choices[0]?.message?.content, auditData)
      auditData = {
        ...auditData,
        summary: typeof parsed.summary === "string" ? parsed.summary : auditData.summary,
      }
      auditData.recommendations = ruleRecommendations
        .filter((rec: any) => Number(rec.confidence || 0) >= confidenceThreshold)
        .slice(0, 8)
    }

    const audit = await prisma.accountAudit.create({
      data: {
        userId,
        workspaceId,
        adAccountId: selectedAdAccountId,
        overallScore: Number(auditData.overallScore || 0),
        scores: auditData.scores || {},
        summary: auditData.summary || "",
        recommendations: auditData.recommendations || [],
        totalPotentialImpact: Number(auditData.totalPotentialImpact || 0),
      },
    })

    await recordActivity({
      userId,
      workspaceId,
      adAccountId: selectedAdAccountId,
      type: "AI_AUDIT_CREATED",
      title: "AI account audit completed",
      message: auditData.summary,
      entityType: "AccountAudit",
      entityId: audit.id,
      metadata: { recommendations: auditData.recommendations.length, overallScore: auditData.overallScore },
    })

    return NextResponse.json({ success: true, ok: true, audit, ...auditData, generatedAt: audit.createdAt.toISOString() })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Audit failed" }, { status: 500 })
  }
}
