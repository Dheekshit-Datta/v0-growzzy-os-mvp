import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId } from "@/lib/workspace"
import { launchPlanToGoogle } from "@/lib/services/google-publish"
import { launchPlanToMeta } from "@/lib/services/meta-publish"
import { rateLimitPolicy, rateLimitResponse } from "@/lib/rate-limit"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  const userId = await resolveUserId(session.user.id)
  const limit = await rateLimitPolicy(userId, "campaignLaunch")
  if (!limit.allowed) return rateLimitResponse(limit)
  const workspaceId = await getRequestWorkspaceId(userId, req)

  const ownedPlan = await prisma.campaignPlan.findFirst({ where: { id: params.id, userId, workspaceId }, select: { platform: true } })
  if (!ownedPlan) return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Campaign plan not found" } }, { status: 404 })
  const result = ownedPlan.platform === "META"
    ? await launchPlanToMeta({ planRowId: params.id, userId, workspaceId })
    : await launchPlanToGoogle({ planRowId: params.id, userId, workspaceId })

  if (!result.ok) {
    const status =
      result.code === "NOT_FOUND" ? 404 :
      result.code === "ALREADY_LIVE" || result.code === "PUBLISH_IN_PROGRESS" || result.code === "BUDGET_CEILING" ? 409 :
      result.code === "AUTH_REQUIRED" ? 401 :
      result.code === "VALIDATION_FAILED" || result.code === "PREFLIGHT_BLOCK" || result.code === "POLICY_BLOCK" || result.code === "POLICY_REQUIRED" || result.code === "POLICY_ACK_REQUIRED" ? 400 :
      502
    return NextResponse.json({ ok: false, error: result.error, code: result.code }, { status })
  }

  return NextResponse.json({
    ok: true,
    data: {
      campaignId: result.campaignId,
      externalCampaignId: result.externalCampaignId,
      adGroupsPublished: result.adGroupsPublished,
      message: `Campaign published to ${ownedPlan.platform === "META" ? "Meta Ads" : "Google Ads"} in PAUSED state. Enable it from the campaign page when ready.`,
    },
  })
}
