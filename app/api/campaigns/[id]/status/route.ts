import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { log } from "@/lib/logger"
import { getRequestWorkspaceId, workspaceWhere } from "@/lib/workspace"
import { isUnverifiedExternalId } from "@/lib/data-trust"
import { mutateCampaignStatusOnPlatform } from "@/lib/platform-mutation"
import { createCorrelationId, parseActionErrorDetails } from "@/lib/action-response"
import { recordActivity } from "@/lib/activity-log"
import { rateLimitPolicy, rateLimitResponse } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

const StatusSchema = z.object({
  status: z.enum(["ACTIVE", "ENABLED", "PAUSED", "ARCHIVED", "REMOVED", "DRAFT"]),
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const correlationId = createCorrelationId()
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized", correlationId, code: "UNAUTHORIZED" }, { status: 401 })
    const userId = await resolveUserId(session.user.id)
    const limit = await rateLimitPolicy(userId, "optimizationMutation")
    if (!limit.allowed) return rateLimitResponse(limit)
    const parsed = StatusSchema.safeParse(await req.json())
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors, correlationId, code: "VALIDATION_FAILED" }, { status: 400 })

    const workspaceId = await getRequestWorkspaceId(userId, req)
    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, userId, ...workspaceWhere(workspaceId, false) },
      include: {
        integration: { include: { adAccounts: true } },
      },
    })
    if (!campaign) return NextResponse.json({ error: "Campaign not found", correlationId, code: "NOT_FOUND" }, { status: 404 })

    if (!campaign.isLive || isUnverifiedExternalId(campaign.externalId)) {
      return NextResponse.json(
        {
          ok: false,
          error: "This is a draft or unverified campaign. GROWZZY will not pretend it changed your ad account.",
        },
        { status: 409 }
      )
    }

    const requestedStatus = parsed.data.status
    let nextStatus = requestedStatus === "ENABLED" ? "ACTIVE" : requestedStatus
    let platformResponse: unknown = null

    if (campaign.platform === "GOOGLE" || campaign.platform === "META") {
      const targetStatus = nextStatus === "ARCHIVED" ? "REMOVED" : nextStatus === "ACTIVE" ? "ACTIVE" : "PAUSED"
      platformResponse = await mutateCampaignStatusOnPlatform(campaign, targetStatus)
      nextStatus = targetStatus === "REMOVED" ? "REMOVED" : targetStatus === "ACTIVE" ? "ACTIVE" : "PAUSED"
    } else {
      return NextResponse.json(
        { ok: false, error: "Unsupported platform for live campaign status changes." },
        { status: 501 }
      )
    }

    const updated = await prisma.campaign.update({
      where: { id: params.id },
      data: {
        status: nextStatus,
        liveStatus: nextStatus === "REMOVED" ? "REMOVED" : nextStatus === "ACTIVE" ? "LIVE_ENABLED" : "LIVE_PAUSED",
        liveError: null,
      },
    })

    await prisma.optimizationLog.create({
      data: {
        userId,
        workspaceId,
        adAccountId: campaign.adAccountId,
        campaignId: updated.id,
        type: "STATUS_CHANGE",
        previousValue: campaign.status,
        appliedValue: nextStatus,
        apiSuccess: true,
        actionPayload: { status: requestedStatus, platform: campaign.platform },
        source: "CAMPAIGN_STATUS",
      },
    }).catch((error) => log("warn", "campaign-status", "Optimization log write failed", { message: error?.message }))

    await recordActivity({
      userId,
      workspaceId,
      adAccountId: campaign.adAccountId,
      type: "CAMPAIGN_STATUS_CHANGED",
      title: `${campaign.name} set to ${nextStatus}`,
      entityType: "Campaign",
      entityId: campaign.id,
      metadata: { correlationId, previousStatus: campaign.status, nextStatus, platformResponse },
    })

    return NextResponse.json({
      ok: true,
      correlationId,
      campaign: updated,
      platformResponse,
      message: `Campaign ${nextStatus.toLowerCase()} in ${campaign.platform} first, then updated in GROWZZY OS.`,
    })
  } catch (error: any) {
    log("error", "api/campaigns/status", "Failed to update campaign status", { message: error?.message })
    const details = parseActionErrorDetails(error?.message || "Failed to update campaign status")
    return NextResponse.json(
      {
        error: details.providerMessage,
        correlationId,
        code: details.code,
        remediation: details.remediation,
      },
      { status: 500 }
    )
  }
}
