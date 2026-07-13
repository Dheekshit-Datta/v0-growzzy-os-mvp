import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId } from "@/lib/workspace"
import { launchPlanToGoogle } from "@/lib/services/google-publish"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  let userId: string
  let workspaceId: string

  if (session?.user?.id) {
    userId = await resolveUserId(session.user.id)
    workspaceId = await getRequestWorkspaceId(userId, req)
  } else {
    const token = req.headers.get("x-checkpoint-launch-token") || ""
    const planRow = await prisma.campaignPlan.findUnique({
      where: { id: params.id },
      select: { userId: true, workspaceId: true, plan: true },
    })
    const expected = String((planRow?.plan as any)?.checkpointLaunchToken || "")
    const valid =
      !!planRow?.workspaceId &&
      expected.length >= 32 &&
      token.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))
    if (!valid) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    userId = planRow.userId
    workspaceId = planRow.workspaceId!
  }

  const limit = await rateLimit(`plan-launch:${userId}`, 10, 60_000)
  if (!limit.allowed) return NextResponse.json({ ok: false, error: "Too many launch attempts — wait a moment" }, { status: 429 })

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
