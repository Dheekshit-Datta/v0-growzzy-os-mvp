import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId } from "@/lib/workspace"
import { assessGoogleSearchPlan } from "@/lib/google-plan-quality"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  const userId = await resolveUserId(session.user.id)
  const workspaceId = await getRequestWorkspaceId(userId, req)

  const plans = await prisma.campaignPlan.findMany({
    where: { userId, workspaceId, status: { not: "FAILED" }, briefInput: { not: Prisma.JsonNull } },
    select: {
      id: true,
      platform: true,
      status: true,
      plan: true,
      briefInput: true,
      createdAt: true,
      launchedCampaignId: true,
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  })

  return NextResponse.json({
    ok: true,
    plans: plans.filter((p) => p.platform !== "GOOGLE" || assessGoogleSearchPlan(p.plan).status !== "FAIL").map((p) => ({
      id: p.id,
      status: p.status,
      campaignName: (p.plan as any)?.campaignName || "Untitled campaign",
      brief: p.briefInput,
      createdAt: p.createdAt,
      launched: !!p.launchedCampaignId,
    })),
  })
}
