import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId, workspaceWhere } from "@/lib/workspace"
import { isUnverifiedExternalId } from "@/lib/data-trust"
import { log } from "@/lib/logger"
import { mutateCampaignStatusOnPlatform } from "@/lib/platform-mutation"
import { createCorrelationId, parseActionErrorDetails } from "@/lib/action-response"
import { recordActivity } from "@/lib/activity-log"
import { rateLimitPolicy, rateLimitResponse } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const correlationId = createCorrelationId()
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized", correlationId, code: "UNAUTHORIZED" }, { status: 401 })
    const userId = await resolveUserId(session.user.id)
    const limit = await rateLimitPolicy(userId, "optimizationMutation")
    if (!limit.allowed) return rateLimitResponse(limit)
    const workspaceId = await getRequestWorkspaceId(userId, req)

    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, userId, ...workspaceWhere(workspaceId, false) },
      include: { integration: { include: { adAccounts: true } } },
    })

    if (!campaign) return NextResponse.json({ error: "Campaign not found", correlationId, code: "NOT_FOUND" }, { status: 404 })

    if (!campaign.isLive || isUnverifiedExternalId(campaign.externalId)) {
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: "REMOVED", liveStatus: "REMOVED", liveError: "Removed local draft only; no platform object existed." },
      })
      return NextResponse.json({ ok: true, correlationId, message: "Draft removed from GROWZZY OS. No ad platform was touched." })
    }

    const platformResponse = await mutateCampaignStatusOnPlatform(campaign, "REMOVED")

    const updated = await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: "REMOVED", liveStatus: "REMOVED", liveError: null },
    })

    await prisma.optimizationLog.create({
      data: {
        userId,
        workspaceId,
        adAccountId: campaign.adAccountId,
        campaignId: updated.id,
        type: "REMOVE_CAMPAIGN",
        previousValue: campaign.status,
        appliedValue: "REMOVED",
        apiSuccess: true,
        source: "CAMPAIGN_REMOVE",
        actionPayload: { platform: campaign.platform, externalId: campaign.externalId },
      },
    }).catch((error) => log("warn", "campaign-remove", "Optimization log write failed", { message: error?.message }))

    await recordActivity({
      userId,
      workspaceId,
      adAccountId: campaign.adAccountId,
      type: "CAMPAIGN_REMOVED",
      title: `${campaign.name} removed`,
      entityType: "Campaign",
      entityId: campaign.id,
      metadata: { correlationId, previousStatus: campaign.status, platformResponse },
    })

    return NextResponse.json({
      ok: true,
      correlationId,
      campaign: updated,
      platformResponse,
      message: `Campaign removed in ${campaign.platform} first, then marked removed in GROWZZY OS.`,
    })
  } catch (error: any) {
    log("error", "api/campaigns/remove", "Failed to remove campaign", { message: error?.message })
    const details = parseActionErrorDetails(error?.message || "Failed to remove campaign")
    return NextResponse.json(
      {
        ok: false,
        error: details.providerMessage,
        correlationId,
        code: details.code,
        remediation: details.remediation,
      },
      { status: 500 }
    )
  }
}
