import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId } from "@/lib/workspace"
import { rateLimitPolicy, rateLimitResponse } from "@/lib/rate-limit"
import { checkPlanPolicy } from "@/lib/services/policy-check"
import { log } from "@/lib/logger/logger"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  const userId = await resolveUserId(session.user.id)
  const limit = await rateLimitPolicy(userId, "campaignLaunch")
  if (!limit.allowed) return rateLimitResponse(limit)
  const workspaceId = await getRequestWorkspaceId(userId, req)

  const ownedPlan = await prisma.campaignPlan.findFirst({
    where: { id: params.id, userId, workspaceId },
    select: {
      id: true,
      platform: true,
      status: true,
      plan: true
    }
  })

  if (!ownedPlan) return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Campaign plan not found" } }, { status: 404 })

  // Check if plan is in a launchable state (LAUNCH_PENDING)
  if (ownedPlan.status !== "LAUNCH_PENDING") {
    return NextResponse.json({
      ok: false,
      error: {
        code: "INVALID_STATUS",
        message: "Campaign plan must be in LAUNCH_PENDING state to initiate launch"
      }
    }, { status: 400 })
  }

  try {
    // For Google campaigns, run policy check before launching
    let policyCheck = null
    let policyAcknowledged = false

    if (ownedPlan.platform === "GOOGLE" && ownedPlan.plan) {
      const plan = ownedPlan.plan as any
      if (plan && plan.adGroups) {
        policyCheck = await checkPlanPolicy(plan.adGroups.map((group: any) => ({
          name: group.name,
          headlines: group.headlines,
          descriptions: group.descriptions
        })))
        policyAcknowledged = policyCheck.status === "PASS"

        // If policy check fails, we don't proceed with launch
        if (!policyAcknowledged) {
          return NextResponse.json({
            ok: false,
            error: {
              code: "POLICY_VIOLATION",
              message: "Campaign plan violates advertising policies and cannot be launched",
              policyCheck
            }
          }, { status: 422 })
        }
      }
    }

    // Update campaign plan to LAUNCH_INITIATED state
    const updatedPlan = await prisma.campaignPlan.update({
      where: { id: params.id },
      data: {
        status: "LAUNCH_INITIATED",
        policyCheck: policyCheck || undefined,
        policyAcknowledged: policyAcknowledged || false,
        launchInitiatedAt: new Date()
      }
    })

    // Log launch initiation
    log("info", "ai/campaign-plan/launch", "Campaign launch initiated", {
      campaignPlanId: params.id,
      userId,
      platform: ownedPlan.platform
    })

    return NextResponse.json({
      ok: true,
      message: "Campaign launch initiated. Syncing to ad platform...",
      campaignPlan: updatedPlan
    })
  } catch (error) {
    console.error("Error launching campaign:", error)

    // Log error
    log("error", "ai/campaign-plan/launch", "Failed to initiate campaign launch", {
      campaignPlanId: params.id,
      userId,
      error: error instanceof Error ? error.message : String(error)
    })

    return NextResponse.json({
      ok: false,
      error: {
        code: "LAUNCH_INITIATION_FAILED",
        message: "Failed to initiate campaign launch"
      }
    }, { status: 500 })
  }
}