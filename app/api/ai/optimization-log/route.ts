import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId } from "@/lib/workspace"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  const userId = await resolveUserId(session.user.id)
  const workspaceId = await getRequestWorkspaceId(userId, req)

  const logs = await prisma.optimizationLog.findMany({
    where: { userId, workspaceId, status: { in: ["APPLIED", "FAILED"] } },
    orderBy: { appliedAt: "desc" },
    take: 30,
    select: {
      id: true,
      type: true,
      previousValue: true,
      appliedValue: true,
      appliedAt: true,
      status: true,
      apiSuccess: true,
      apiError: true,
      campaignId: true,
      undoneAt: true,
    },
  })

  return NextResponse.json({ ok: true, logs })
}
