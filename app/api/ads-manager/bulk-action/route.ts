import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId } from "@/lib/workspace"
import { recordActivity } from "@/lib/activity-log"
import { createCorrelationId, parseActionErrorDetails } from "@/lib/action-response"
import {
  mutateCampaignStatusOnPlatform,
  mutateGoogleCampaignBudgetOnPlatform,
} from "@/lib/platform-mutation"
import { rateLimitPolicy, rateLimitResponse } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

const BulkActionSchema = z.object({
  ids: z.array(z.string()).min(1).max(50),
  action: z.enum(["PAUSE", "RESUME", "REMOVE", "INCREASE_BUDGET", "DECREASE_BUDGET"]),
  percent: z.number().min(1).max(30).optional(),
})

async function applyOne({
  campaign,
  action,
  percent,
  userId,
  workspaceId,
}: {
  campaign: any
  action: z.infer<typeof BulkActionSchema>["action"]
  percent?: number
  userId: string
  workspaceId: string
}) {
  const previousValue =
    action === "INCREASE_BUDGET" || action === "DECREASE_BUDGET" ? String(campaign.budgetAmount || 0) : campaign.status
  let appliedValue = previousValue

  if (action === "INCREASE_BUDGET" || action === "DECREASE_BUDGET") {
    const safePercent = Math.min(30, Math.max(1, percent || 10))
    const direction = action === "INCREASE_BUDGET" ? 1 : -1
    const currentBudget = Number(campaign.budgetAmount || campaign.dailyBudget || 0)
    if (currentBudget <= 0) throw new Error("Current budget is missing, so budget change is blocked.")
    const nextBudget = Number((currentBudget * (1 + direction * (safePercent / 100))).toFixed(2))
    await mutateGoogleCampaignBudgetOnPlatform(campaign, nextBudget)
    await prisma.campaign.update({ where: { id: campaign.id }, data: { budgetAmount: nextBudget, liveError: null } })
    appliedValue = String(nextBudget)
  } else {
    const targetStatus = action === "RESUME" ? "ACTIVE" : action === "REMOVE" ? "REMOVED" : "PAUSED"
    await mutateCampaignStatusOnPlatform(campaign, targetStatus)
    const nextStatus = targetStatus === "ACTIVE" ? "ACTIVE" : targetStatus === "REMOVED" ? "REMOVED" : "PAUSED"
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        status: nextStatus,
        liveStatus: nextStatus === "REMOVED" ? "REMOVED" : nextStatus === "ACTIVE" ? "LIVE_ENABLED" : "LIVE_PAUSED",
        liveError: null,
      },
    })
    appliedValue = nextStatus
  }

  await prisma.optimizationLog.create({
    data: {
      userId,
      workspaceId,
      adAccountId: campaign.adAccountId,
      campaignId: campaign.id,
      type: `BULK_${action}`,
      previousValue,
      appliedValue,
      apiSuccess: true,
      status: "APPLIED",
      source: "ADS_MANAGER",
      approvedAt: new Date(),
      actionPayload: { action, percent, platform: campaign.platform },
    },
  })

  await recordActivity({
    userId,
    workspaceId,
    adAccountId: campaign.adAccountId,
    type: "ADS_MANAGER_BULK_ACTION",
    title: `${action.replace("_", " ")} applied to ${campaign.name}`,
    entityType: "Campaign",
    entityId: campaign.id,
    metadata: { action, previousValue, appliedValue, platform: campaign.platform },
  })

  return { id: campaign.id, ok: true, appliedValue }
}

export async function POST(req: NextRequest) {
  const correlationId = createCorrelationId()
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized", correlationId, code: "UNAUTHORIZED" }, { status: 401 })

  const userId = await resolveUserId(session.user.id)
  const limit = await rateLimitPolicy(userId, "optimizationMutation")
  if (!limit.allowed) return rateLimitResponse(limit)
  const workspaceId = await getRequestWorkspaceId(userId, req)
  const parsed = BulkActionSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors, correlationId, code: "VALIDATION_FAILED" }, { status: 400 })

  const campaigns = await prisma.campaign.findMany({
    where: {
      id: { in: parsed.data.ids },
      userId,
      workspaceId,
      integration: { hasAdsAccess: true, status: { in: ["OAUTH_GRANTED", "ACCOUNT_SELECTED", "INITIAL_SYNC_RUNNING", "ACTIVE", "SYNC_FAILED"] } },
    },
    include: {
      integration: { include: { adAccounts: true } },
    },
    take: 50,
  })

  const results = []
  for (const campaign of campaigns) {
    try {
      results.push(
        await applyOne({
          campaign,
          action: parsed.data.action,
          percent: parsed.data.percent,
          userId,
          workspaceId,
        })
      )
    } catch (error: any) {
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { liveError: error?.message || "Bulk action failed" },
      }).catch(() => undefined)
      const message = error?.message || "Bulk action failed"
      const details = parseActionErrorDetails(message)
      results.push({
        id: campaign.id,
        ok: false,
        error: details.providerMessage,
        code: details.code,
        remediation: details.remediation,
      })
    }
  }

  const missingIds = parsed.data.ids.filter((id) => !campaigns.some((campaign) => campaign.id === id))
  for (const id of missingIds) results.push({ id, ok: false, error: "Campaign not found in this workspace." })

  return NextResponse.json({
    ok: results.some((result) => result.ok),
    correlationId,
    results,
    successCount: results.filter((result) => result.ok).length,
    failureCount: results.filter((result) => !result.ok).length,
  })
}
