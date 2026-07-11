import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId, workspaceWhere } from "@/lib/workspace"
import { recordActivity } from "@/lib/activity-log"
import { createCorrelationId } from "@/lib/action-response"

export async function POST(req: NextRequest) {
  const correlationId = createCorrelationId()
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized", correlationId, code: "UNAUTHORIZED" }, { status: 401 })
  const userId = await resolveUserId(session.user.id)
  const workspaceId = await getRequestWorkspaceId(userId, req)
  const workspaceFilter = workspaceWhere(workspaceId, false)
  const body = await req.json()
  const { recommendationId, auditId, type, campaignId, recommendedValue, riskLevel, confidence, source } = body

  if (!recommendationId || !type || !campaignId) {
    return NextResponse.json({ error: "recommendationId, type and campaignId are required", correlationId, code: "VALIDATION_FAILED" }, { status: 400 })
  }

  const campaign = await prisma.campaign.findFirst({
    where: {
      userId,
      AND: [
        workspaceFilter,
        { OR: [{ id: campaignId }, { externalId: campaignId }] },
      ],
    },
    include: { integration: { include: { adAccounts: true } } },
  })
  if (!campaign) return NextResponse.json({ error: "Campaign not found", correlationId, code: "NOT_FOUND" }, { status: 404 })

  const previousValue =
    type === "BUDGET_INCREASE" || type === "BUDGET_DECREASE"
      ? String(campaign.budgetAmount || 0)
      : type === "PAUSE" || type === "ENABLE"
        ? String(campaign.status)
        : String(campaign.cpc || 0)

  const actionPayload = {
    recommendationId,
    type,
    campaignId: campaign.id,
    externalId: campaign.externalId,
    recommendedValue: recommendedValue ?? "",
    platform: campaign.platform,
  }
  const undoPayload = {
    type,
    campaignId: campaign.id,
    externalId: campaign.externalId,
    previousValue,
    platform: campaign.platform,
  }

  const log = await prisma.optimizationLog.create({
    data: {
      userId,
      workspaceId,
      adAccountId: campaign.adAccountId,
      auditId: auditId || null,
      campaignId: campaign.id,
      type,
      previousValue,
      appliedValue: String(recommendedValue ?? ""),
      status: "PENDING_APPROVAL",
      riskLevel: riskLevel || (type === "PAUSE" ? "HIGH" : type.includes("BUDGET") ? "MEDIUM" : "LOW"),
      confidence: Number(confidence || 0),
      source: source || "AI_ADVISOR",
      actionPayload,
      undoPayload,
      apiSuccess: false,
    },
  })

  await recordActivity({
    userId,
    workspaceId,
    adAccountId: campaign.adAccountId,
    type: "OPTIMIZATION_PREVIEWED",
    title: `Previewed ${type} for ${campaign.name}`,
    message: `AI will not apply this until approved.`,
    entityType: "OptimizationLog",
    entityId: log.id,
    metadata: actionPayload,
  })

  return NextResponse.json({
    ok: true,
    preview: {
      id: log.id,
      correlationId,
      campaignName: campaign.name,
      previousValue,
      recommendedValue: String(recommendedValue ?? ""),
      riskLevel: log.riskLevel,
      confidence: log.confidence,
      actionPayload,
      undoPayload,
      trustCopy: "AI never changes campaigns without approval.",
    },
  })
}
