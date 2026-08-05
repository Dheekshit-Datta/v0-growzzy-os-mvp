import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { resolveUserId } from "@/lib/resolve-user"
import { prisma } from "@/lib/prisma"
import { recordActivity } from "@/lib/activity-log"
import { getRequestWorkspaceId, workspaceWhere } from "@/lib/workspace"
import { mutateCampaignStatusOnPlatform, mutateGoogleCampaignBudgetOnPlatform } from "@/lib/platform-mutation"
import { classifyActionError, createCorrelationId } from "@/lib/action-response"
import { getIntegrationAccessToken } from "@/lib/integration-tokens"
import { rateLimitPolicy, rateLimitResponse } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

function parseNumericValue(input: string) {
  const normalized = String(input || "").replace(/[^0-9.]/g, "")
  const value = Number(normalized)
  return Number.isFinite(value) ? value : 0
}

export async function POST(req: NextRequest) {
  const correlationId = createCorrelationId()
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized", correlationId, code: "UNAUTHORIZED" }, { status: 401 })
    const userId = await resolveUserId(session.user.id)
    const limit = await rateLimitPolicy(userId, "optimizationMutation")
    if (!limit.allowed) return rateLimitResponse(limit)
    const workspaceId = await getRequestWorkspaceId(userId, req)
    const workspaceFilter = workspaceWhere(workspaceId, false)
    const body = await req.json()

    const { recommendationId, type, campaignId, recommendedValue, auditId, previewId } = body
    if (!recommendationId || !type || !campaignId) {
      return NextResponse.json({ error: "recommendationId, type and campaignId are required", correlationId, code: "VALIDATION_FAILED" }, { status: 400 })
    }

    const previewLog = previewId
      ? await prisma.optimizationLog.findFirst({ where: { id: previewId, userId, status: "PENDING_APPROVAL" } })
      : null

    const campaign = await prisma.campaign.findFirst({
      where: {
        userId,
        AND: [
          workspaceFilter,
          { OR: [{ id: campaignId }, { externalId: campaignId }] },
        ],
      },
      include: {
        integration: {
          include: {
            adAccounts: true,
          },
        },
      },
    })
    if (!campaign) return NextResponse.json({ error: "Campaign not found", correlationId, code: "NOT_FOUND" }, { status: 404 })

    if (!["BUDGET_INCREASE", "BUDGET_DECREASE", "PAUSE", "ENABLE", "CREATIVE_REFRESH"].includes(type)) {
      return NextResponse.json({ error: "Unsupported optimization action.", correlationId, code: "UNSUPPORTED_ACTION" }, { status: 400 })
    }

    const integration = campaign.integration
    if (!previewLog) {
      return NextResponse.json({ error: "Preview approval is required before applying an optimization.", correlationId, code: "APPROVAL_REQUIRED" }, { status: 409 })
    }

    if (type === "CREATIVE_REFRESH") {
      await prisma.optimizationLog.update({
        where: { id: previewLog.id },
        data: {
          previousValue: "creative_refresh_pending",
          appliedValue: "redirect_to_creatives",
          apiSuccess: true,
          status: "APPLIED",
          approvedAt: new Date(),
          source: "AI_ADVISOR",
        },
      })
      await recordActivity({
        userId,
        workspaceId,
        adAccountId: campaign.adAccountId,
        type: "OPTIMIZATION_APPLIED",
        title: `Creative refresh opened for ${campaign.name}`,
        entityType: "Campaign",
        entityId: campaign.id,
      })
      return NextResponse.json({ ok: true, redirectTo: `/dashboard/creatives?campaignId=${campaign.id}`, message: "Open Creative Studio to refresh this campaign" })
    }

    if (campaign.platform !== "GOOGLE" || !integration || !getIntegrationAccessToken(integration) || !integration.selectedAdAccountId) {
      await prisma.optimizationLog.update({
        where: { id: previewLog.id },
        data: {
          status: "FAILED",
          error: "Only Google optimization actions are currently supported",
          apiError: "Only Google optimization actions are currently supported",
        },
      })
      return NextResponse.json({ error: "Only Google optimization actions are currently supported", correlationId, code: "PREFLIGHT_BLOCK" }, { status: 400 })
    }

    const previousValue =
      type === "BUDGET_INCREASE" || type === "BUDGET_DECREASE"
        ? String(campaign.budgetAmount || 0)
        : type === "PAUSE" || type === "ENABLE"
          ? String(campaign.status)
          : String(campaign.cpc || 0)

    if (type === "BUDGET_INCREASE" || type === "BUDGET_DECREASE") {
      const amount = parseNumericValue(recommendedValue)
      const current = Number(campaign.budgetAmount || 0)
      const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { dailyBudgetCeiling: true, maxDailyBudgetShiftPct: true } })
      const maxShift = workspace?.maxDailyBudgetShiftPct ?? 0.2
      if (amount <= 0 || (current > 0 && Math.abs(amount - current) / current > maxShift + 0.0001)) {
        return NextResponse.json({ error: `Budget changes are limited to ${Math.round(maxShift * 100)}% per action.`, correlationId, code: "BUDGET_GUARDRAIL" }, { status: 400 })
      }
      if (workspace?.dailyBudgetCeiling != null && amount > workspace.dailyBudgetCeiling) {
        return NextResponse.json({ error: "This change exceeds the workspace daily budget ceiling.", correlationId, code: "BUDGET_CEILING" }, { status: 400 })
      }
    }

    let apiSuccess = false
    let apiError: string | null = null

    try {
    if (type === "BUDGET_INCREASE" || type === "BUDGET_DECREASE") {
      const amount = parseNumericValue(recommendedValue)
      await mutateGoogleCampaignBudgetOnPlatform(campaign, amount)
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { budgetAmount: amount },
      })
      apiSuccess = true
    } else if (type === "PAUSE" || type === "ENABLE") {
      await mutateCampaignStatusOnPlatform(campaign, type === "PAUSE" ? "PAUSED" : "ACTIVE")
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          status: type === "PAUSE" ? "PAUSED" : "ACTIVE",
          liveStatus: type === "PAUSE" ? "LIVE_PAUSED" : "LIVE_ENABLED",
        },
      })
      apiSuccess = true
    }
    } catch (error: any) {
      apiError = error?.message || "Google Ads update failed"
    }

    await prisma.optimizationLog.update({
      where: { id: previewLog.id },
      data: {
        previousValue,
        appliedValue: String(recommendedValue ?? ""),
        apiSuccess,
        apiError,
        error: apiError,
        status: apiError ? "FAILED" : "APPLIED",
        approvedAt: apiError ? null : new Date(),
      },
    })

    if (apiError) return NextResponse.json({ error: apiError, correlationId, code: classifyActionError(apiError) }, { status: 500 })

    // recommendationId is the OptimizationSuggestion id when the apply came
    // from the Recommendations tab - mark it applied so it stops showing as
    // a live suggestion. Not every caller of this route originates from a
    // suggestion, so a missing row here is expected and not an error.
    await prisma.optimizationSuggestion.updateMany({
      where: { id: recommendationId, workspaceId },
      data: { applied: true },
    })

    await recordActivity({
      userId,
      workspaceId,
      adAccountId: campaign.adAccountId,
      type: "OPTIMIZATION_APPLIED",
      title: `${type} applied to ${campaign.name}`,
      message: `${previousValue} -> ${String(recommendedValue ?? "")}`,
      entityType: "OptimizationLog",
      entityId: previewLog.id,
    })

    return NextResponse.json({
      ok: true,
      correlationId,
      message: "Optimization applied to Google Ads",
      recommendationId,
      campaignId: campaign.id,
    })
  } catch (error: any) {
    const message = error?.message || "Failed to apply optimization"
    return NextResponse.json({ error: message, correlationId, code: classifyActionError(message) }, { status: 500 })
  }
}
