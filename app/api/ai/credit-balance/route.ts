import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId } from "@/lib/workspace"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 })
  const userId = await resolveUserId(session.user.id)
  const workspaceId = await getRequestWorkspaceId(userId, req)
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { monthlyCredits: true, usedCreditsThisMonth: true, creditResetDay: true },
  })
  if (!workspace) return NextResponse.json({ ok: false, error: { code: "WORKSPACE_NOT_FOUND", message: "Workspace not found" } }, { status: 404 })

  const now = new Date()
  const resetDate = new Date(now.getFullYear(), now.getMonth() + (now.getDate() >= workspace.creditResetDay ? 1 : 0), workspace.creditResetDay)
  return NextResponse.json({
    ok: true,
    data: {
      allocatedCredits: workspace.monthlyCredits,
      usedCredits: workspace.usedCreditsThisMonth,
      remainingCredits: Math.max(0, workspace.monthlyCredits - workspace.usedCreditsThisMonth),
      resetDate: resetDate.toISOString(),
    },
  })
}
