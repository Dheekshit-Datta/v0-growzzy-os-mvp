import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId } from "@/lib/workspace"
import { launchPlanToGoogle } from "@/lib/services/google-publish"
import { rateLimitPolicy, rateLimitResponse } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  const userId = await resolveUserId(session.user.id)
  const limit = await rateLimitPolicy(userId, "campaignLaunch")
  if (!limit.allowed) return rateLimitResponse(limit)
  const workspaceId = await getRequestWorkspaceId(userId, req)

  const result = await launchPlanToGoogle({ planRowId: params.id, userId, workspaceId })

  if (!result.ok) {
    const status =
      result.code === "NOT_FOUND" ? 404 :
      result.code === "ALREADY_LIVE" || result.code === "PUBLISH_IN_PROGRESS" || result.code === "BUDGET_CEILING" ? 409 :
      result.code === "AUTH_REQUIRED" ? 401 :
      result.code === "VALIDATION_FAILED" || result.code === "PREFLIGHT_BLOCK" || result.code === "POLICY_BLOCK" ? 400 :
      502
    return NextResponse.json({ ok: false, error: result.error, code: result.code }, { status })
  }

  return NextResponse.json({
    ok: true,
    data: {
      campaignId: result.campaignId,
      externalCampaignId: result.externalCampaignId,
      adGroupsPublished: result.adGroupsPublished,
      message: "Campaign published to Google Ads in PAUSED state. Enable it from the campaign page when ready.",
    },
  })
}
