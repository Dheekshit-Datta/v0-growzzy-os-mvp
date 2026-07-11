import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { log } from "@/lib/logger"
import { getRequestWorkspaceId } from "@/lib/workspace"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const userId = await resolveUserId(session.user.id)
    const workspaceId = await getRequestWorkspaceId(userId)
    const [user, connectedIntegrations] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { onboardingCompleted: true, onboardingStep: true },
      }),
      prisma.integration.count({
        where: {
          userId,
          workspaceId,
          selectedAdAccountId: { not: null },
          status: { in: ["ACTIVE", "ACCOUNT_SELECTED", "INITIAL_SYNC_RUNNING"] },
        },
      }),
    ])

    return NextResponse.json({
      onboardingCompleted: Boolean(user?.onboardingCompleted),
      onboardingStep: user?.onboardingStep ?? 0,
      connectedIntegrations,
      shouldShowOnboarding: !user?.onboardingCompleted && connectedIntegrations === 0,
    })
  } catch (error: any) {
    log("error", "api/onboarding", "Failed to read onboarding state", { message: error.message })
    return NextResponse.json({ error: "Failed to read onboarding state" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const userId = await resolveUserId(session.user.id)
    const body = await req.json().catch(() => ({}))
    const onboardingStep = Number.isFinite(Number(body.onboardingStep)) ? Number(body.onboardingStep) : undefined
    const onboardingCompleted =
      typeof body.onboardingCompleted === "boolean" ? Boolean(body.onboardingCompleted) : undefined

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(onboardingStep !== undefined ? { onboardingStep } : {}),
        ...(onboardingCompleted !== undefined ? { onboardingCompleted } : {}),
      },
      select: { onboardingCompleted: true, onboardingStep: true },
    })

    return NextResponse.json({ ok: true, user })
  } catch (error: any) {
    log("error", "api/onboarding", "Failed to update onboarding state", { message: error.message })
    return NextResponse.json({ error: "Failed to update onboarding state" }, { status: 500 })
  }
}
