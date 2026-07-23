import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { auth } from "@/lib/auth"
import { resolveUserId } from "@/lib/resolve-user"
import { prisma } from "@/lib/prisma"
import { assertWorkspaceMember, getRequestWorkspaceId } from "@/lib/workspace"
import { buildDailyBriefFromCampaigns } from "@/lib/daily-brief"
import { recordActivity } from "@/lib/activity-log"
import { log } from "@/lib/logger"
import { verifiedMetricCampaignWhere } from "@/lib/data-trust"
import { rateLimitPolicy, rateLimitResponse } from "@/lib/rate-limit"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" })

function startOfToday() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

function sevenDaysAgo() {
  const date = new Date()
  date.setDate(date.getDate() - 7)
  date.setHours(0, 0, 0, 0)
  return date
}

async function loadGoogleCampaigns(userId: string, workspaceId: string) {
  const integration = await prisma.integration.findFirst({
    where: { userId, workspaceId, platform: "GOOGLE", hasAdsAccess: true, status: { in: ["OAUTH_GRANTED", "ACCOUNT_SELECTED", "INITIAL_SYNC_RUNNING", "ACTIVE", "SYNC_FAILED"] } },
    select: { id: true, selectedAdAccountId: true, accountId: true },
  })
  const selectedAdAccountId = integration?.selectedAdAccountId || integration?.accountId || null
  if (!integration || !selectedAdAccountId) return { campaigns: [], adAccountId: null }

  const campaigns = await prisma.campaign.findMany({
    where: verifiedMetricCampaignWhere({
      userId,
      workspaceId,
      platform: "GOOGLE",
      integrationId: integration.id,
      adAccountId: selectedAdAccountId,
    }),
    include: {
      metricsDaily: {
        where: { metricDate: { gte: sevenDaysAgo() } },
        orderBy: { metricDate: "desc" },
      },
    },
    orderBy: { spend: "desc" },
    take: 100,
  })
  return { campaigns, adAccountId: selectedAdAccountId }
}

async function maybePolishSummary(brief: ReturnType<typeof buildDailyBriefFromCampaigns>) {
  if (!process.env.OPENAI_API_KEY || !brief.recommendations.length) return brief.summary

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_AUDIT_MODEL || "gpt-4o",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are GROWZZY OS, a concise AI media buyer. Rewrite the daily brief summary using only the provided facts. Do not add metrics, campaigns, or claims that are not present.",
        },
        {
          role: "user",
          content: JSON.stringify({
            summary: brief.summary,
            accountHealth: brief.accountHealth,
            moneyWasted: brief.moneyWasted,
            creativeFatigueAlerts: brief.creativeFatigueAlerts,
            recommendations: brief.recommendations.slice(0, 3),
          }),
        },
      ],
    })
    return completion.choices[0]?.message?.content?.trim() || brief.summary
  } catch (error: any) {
    log("warn", "api/ai/daily-brief", "AI summary polish failed; using deterministic summary", { message: error?.message })
    return brief.summary
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = await resolveUserId(session.user.id)
    const workspaceId = await getRequestWorkspaceId(userId, req)
    const briefDate = startOfToday()

    const loaded = await loadGoogleCampaigns(userId, workspaceId)
    const { campaigns, adAccountId } = loaded
    if (!adAccountId) {
      return NextResponse.json({
        ok: true,
        brief: null,
        readiness: "NO_SELECTED_AD_ACCOUNT",
        message: "Connect Google Ads and select an ad account to generate a daily brief.",
      })
    }
    let brief = await prisma.dailyBrief.findUnique({
      where: { userId_workspaceId_adAccountId_briefDate: { userId, workspaceId, adAccountId, briefDate } },
    })
    const existingCampaignCount = Number((brief?.accountHealth as any)?.campaignCount || 0)

    if (!campaigns.length) {
      return NextResponse.json({
        ok: true,
        brief: null,
        readiness: "NO_VERIFIED_CAMPAIGN_METRICS",
        message: "Sync verified Google Ads campaign metrics to generate a daily brief.",
      })
    }

    if (!brief || (existingCampaignCount === 0 && campaigns.length > 0)) {
      const data = buildDailyBriefFromCampaigns(campaigns)
      const summary = await maybePolishSummary(data)
      brief = await prisma.dailyBrief.upsert({
        where: { userId_workspaceId_adAccountId_briefDate: { userId, workspaceId, adAccountId, briefDate } },
        update: {
          summary,
          accountHealth: data.accountHealth,
          moneyWasted: data.moneyWasted,
          creativeFatigueAlerts: data.creativeFatigueAlerts,
          recommendations: data.recommendations,
        },
        create: {
          userId,
          workspaceId,
          adAccountId,
          briefDate,
          summary,
          accountHealth: data.accountHealth,
          moneyWasted: data.moneyWasted,
          creativeFatigueAlerts: data.creativeFatigueAlerts,
          recommendations: data.recommendations,
        },
      })
      await recordActivity({
        userId,
        workspaceId,
        adAccountId,
        type: "DAILY_BRIEF_CREATED",
        title: "Daily AI brief generated",
        message: summary,
        entityType: "DailyBrief",
        entityId: brief.id,
      })
    }

    return NextResponse.json({ ok: true, brief })
  } catch (error: any) {
    log("error", "api/ai/daily-brief", "Failed to load daily brief", { message: error?.message, stack: error?.stack })
    return NextResponse.json({ error: "Failed to load daily brief" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = await resolveUserId(session.user.id)
    const limit = await rateLimitPolicy(userId, "aiUtility")
    if (!limit.allowed) return rateLimitResponse(limit)
    const body = await req.json().catch(() => ({}))
    const workspace = body.workspaceId ? await assertWorkspaceMember(userId, body.workspaceId) : await assertWorkspaceMember(userId, await getRequestWorkspaceId(userId, req))
    const workspaceId = workspace.id
    const briefDate = startOfToday()
    const { campaigns, adAccountId } = await loadGoogleCampaigns(userId, workspaceId)
    if (!adAccountId) {
      return NextResponse.json({ ok: false, code: "NO_SELECTED_AD_ACCOUNT", error: "Select a Google Ads account first." }, { status: 409 })
    }
    if (!campaigns.length) {
      return NextResponse.json(
        {
          ok: false,
          code: "NO_VERIFIED_CAMPAIGN_METRICS",
          error: "Google Ads is connected, but no verified campaign metrics are available yet. Sync campaigns before generating a daily brief.",
        },
        { status: 409 }
      )
    }
    const data = buildDailyBriefFromCampaigns(campaigns)
    const summary = await maybePolishSummary(data)

    const brief = await prisma.dailyBrief.upsert({
      where: { userId_workspaceId_adAccountId_briefDate: { userId, workspaceId, adAccountId, briefDate } },
      update: {
        summary,
        accountHealth: data.accountHealth,
        moneyWasted: data.moneyWasted,
        creativeFatigueAlerts: data.creativeFatigueAlerts,
        recommendations: data.recommendations,
      },
      create: {
        userId,
        workspaceId,
        adAccountId,
        briefDate,
        summary,
        accountHealth: data.accountHealth,
        moneyWasted: data.moneyWasted,
        creativeFatigueAlerts: data.creativeFatigueAlerts,
        recommendations: data.recommendations,
      },
    })

    await recordActivity({
      userId,
      workspaceId,
      adAccountId,
      type: "DAILY_BRIEF_REFRESHED",
      title: "Daily AI brief refreshed",
      message: summary,
      entityType: "DailyBrief",
      entityId: brief.id,
    })

    return NextResponse.json({ ok: true, brief })
  } catch (error: any) {
    log("error", "api/ai/daily-brief", "Failed to refresh daily brief", { message: error?.message, stack: error?.stack })
    return NextResponse.json({ error: "Failed to refresh daily brief" }, { status: 500 })
  }
}
