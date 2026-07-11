import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId, workspaceWhere } from "@/lib/workspace"
import { recordActivity } from "@/lib/activity-log"
import { mutateCampaignStatusOnPlatform, mutateGoogleCampaignBudgetOnPlatform } from "@/lib/platform-mutation"
import { classifyActionError, createCorrelationId } from "@/lib/action-response"

function parseNumericValue(input: string) {
  const value = Number(String(input || "").replace(/[^0-9.]/g, ""))
  return Number.isFinite(value) ? value : 0
}

export async function POST(req: NextRequest) {
  const correlationId = createCorrelationId()
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized", correlationId, code: "UNAUTHORIZED" }, { status: 401 })
  const userId = await resolveUserId(session.user.id)
  const workspaceId = await getRequestWorkspaceId(userId, req)
  const workspaceFilter = workspaceWhere(workspaceId, false)
  const { optimizationLogId } = await req.json()
  if (!optimizationLogId) return NextResponse.json({ error: "optimizationLogId is required", correlationId, code: "VALIDATION_FAILED" }, { status: 400 })

  const log = await prisma.optimizationLog.findFirst({
    where: {
      id: optimizationLogId,
      userId,
      status: "APPLIED",
      undoneAt: null,
      campaign: workspaceFilter,
    },
    include: {
      campaign: {
        include: { integration: { include: { adAccounts: true } } },
      },
    },
  })
  if (!log?.campaign) return NextResponse.json({ error: "Applied optimization not found", correlationId, code: "NOT_FOUND" }, { status: 404 })

  const campaign = log.campaign
  const integration = campaign.integration
  if (campaign.platform !== "GOOGLE" || !integration?.accessToken || !integration.selectedAdAccountId) {
    return NextResponse.json({ error: "Undo is currently supported for Google campaign actions only.", correlationId, code: "PREFLIGHT_BLOCK" }, { status: 400 })
  }

  try {
    if (log.type === "BUDGET_INCREASE" || log.type === "BUDGET_DECREASE") {
      const previousBudget = parseNumericValue(log.previousValue)
      await mutateGoogleCampaignBudgetOnPlatform(campaign, previousBudget)
      await prisma.campaign.update({ where: { id: campaign.id }, data: { budgetAmount: previousBudget } })
    } else if (log.type === "PAUSE" || log.type === "ENABLE") {
      const previousStatus = String(log.previousValue || "").toUpperCase()
      if (!["PAUSED", "ENABLED", "ACTIVE"].includes(previousStatus)) {
        return NextResponse.json({ error: "Previous status is not safe to restore automatically.", correlationId, code: "UNDO_NOT_SUPPORTED" }, { status: 400 })
      }
      const desired = previousStatus === "ACTIVE" || previousStatus === "ENABLED" ? "ACTIVE" : "PAUSED"
      await mutateCampaignStatusOnPlatform(campaign, desired)
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          status: desired,
          liveStatus: desired === "ACTIVE" ? "LIVE_ENABLED" : "LIVE_PAUSED",
        },
      })
    } else {
      return NextResponse.json({ error: "This optimization type cannot be undone automatically.", correlationId, code: "UNDO_NOT_SUPPORTED" }, { status: 400 })
    }

    await prisma.optimizationLog.update({
      where: { id: log.id },
      data: { status: "UNDONE", undoneAt: new Date(), apiSuccess: true },
    })
    await recordActivity({
      userId,
      workspaceId,
      adAccountId: campaign.adAccountId,
      type: "OPTIMIZATION_UNDONE",
      title: `${log.type} undone for ${campaign.name}`,
      message: `Restored ${log.previousValue}`,
      entityType: "OptimizationLog",
      entityId: log.id,
    })
    return NextResponse.json({ ok: true, correlationId, message: "Optimization undone in Google Ads" })
  } catch (error: any) {
    await prisma.optimizationLog.update({
      where: { id: log.id },
      data: { error: error?.message || "Undo failed" },
    })
    const message = error?.message || "Undo failed"
    return NextResponse.json({ error: message, correlationId, code: classifyActionError(message) }, { status: 500 })
  }
}
