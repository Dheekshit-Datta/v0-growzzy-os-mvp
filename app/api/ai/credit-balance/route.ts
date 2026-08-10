import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId } from "@/lib/workspace"
import { prisma } from "@/lib/prisma"
import { creditResetDate } from "@/lib/ai-credits"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 })
  const userId = await resolveUserId(session.user.id)
  const workspaceId = await getRequestWorkspaceId(userId, req)
  let monthlyCredits = 1000
  let usedCreditsThisMonth = 0
  let creditResetDay = 1
  try {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { monthlyCredits: true, usedCreditsThisMonth: true, creditResetDay: true },
    })
    if (workspace) {
      monthlyCredits = workspace.monthlyCredits ?? 1000
      usedCreditsThisMonth = workspace.usedCreditsThisMonth ?? 0
      creditResetDay = workspace.creditResetDay ?? 1
    }
  } catch {
    // Graceful fallback if database table lacks monthlyCredits column
  }

  const now = new Date()
  const resetMonth = now.getDate() >= creditResetDay ? now.getMonth() + 1 : now.getMonth()
  const resetDate = creditResetDate(now.getFullYear(), resetMonth, creditResetDay)
  return NextResponse.json({
    ok: true,
    data: {
      allocatedCredits: monthlyCredits,
      usedCredits: usedCreditsThisMonth,
      remainingCredits: Math.max(0, monthlyCredits - usedCreditsThisMonth),
      resetDate: resetDate.toISOString(),
    },
  })
}
