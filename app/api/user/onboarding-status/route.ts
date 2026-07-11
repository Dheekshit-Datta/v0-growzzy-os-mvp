import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId } from "@/lib/workspace"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = await resolveUserId(session.user.id)
    const workspaceId = await getRequestWorkspaceId(userId)
    const [user, platformCount] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { onboardingCompleted: true, onboardingStep: true },
      }),
      prisma.integration.count({
        where: { userId, workspaceId, selectedAdAccountId: { not: null } },
      }),
    ])

    return NextResponse.json({
      connected: platformCount > 0,
      platformCount,
      onboardingCompleted: Boolean(user?.onboardingCompleted),
      onboardingStep: user?.onboardingStep ?? 0,
    })
  } catch {
    return NextResponse.json({ error: "Failed to check status" }, { status: 500 })
  }
}
