import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId } from "@/lib/workspace"
import { rateLimitPolicy, rateLimitResponse } from "@/lib/rate-limit"
import { launchPlanToGoogle } from "@/lib/services/google-publish"
import { launchPlanToMeta } from "@/lib/services/meta-publish"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 })

  const userId = await resolveUserId(session.user.id)
  const limit = await rateLimitPolicy(userId, "campaignLaunch")
  if (!limit.allowed) return rateLimitResponse(limit)

  const workspaceId = await getRequestWorkspaceId(userId, req)
  const plan = await prisma.campaignPlan.findFirst({
    where: { id: params.id, userId, workspaceId },
    select: { platform: true },
  })
  if (!plan) return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Campaign plan not found" } }, { status: 404 })

  const result = plan.platform === "META"
    ? await launchPlanToMeta({ planRowId: params.id, userId, workspaceId })
    : await launchPlanToGoogle({ planRowId: params.id, userId, workspaceId })

  return NextResponse.json(
    result.ok ? { ok: true, data: result } : { ok: false, error: { code: result.code || "LAUNCH_FAILED", message: result.error || "Launch failed" } },
    { status: result.ok ? 200 : result.code === "NOT_FOUND" ? 404 : result.code === "AUTH_REQUIRED" ? 401 : 422 },
  )
}
