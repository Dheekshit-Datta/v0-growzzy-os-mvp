import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId } from "@/lib/workspace"
import { checkPlanPolicy } from "@/lib/services/policy-check"
import { rateLimitPolicy, rateLimitResponse } from "@/lib/rate-limit"
import { assessGoogleSearchPlan } from "@/lib/google-plan-quality"

export const dynamic = "force-dynamic"

const BodySchema = z.object({
  campaignPlanId: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  const userId = await resolveUserId(session.user.id)
  const limit = await rateLimitPolicy(userId, "aiUtility")
  if (!limit.allowed) return rateLimitResponse(limit)
  const workspaceId = await getRequestWorkspaceId(userId, req)

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || "Invalid request" }, { status: 400 })
  }

  const planRow = await prisma.campaignPlan.findFirst({
    where: { id: parsed.data.campaignPlanId, userId, workspaceId },
  })
  if (!planRow) return NextResponse.json({ ok: false, error: "Campaign plan not found" }, { status: 404 })

  const plan = planRow.plan as any
  if (planRow.platform === "GOOGLE") {
    const qualityCheck = assessGoogleSearchPlan(plan)
    if (qualityCheck.status === "FAIL") {
      await prisma.campaignPlan.update({
        where: { id: planRow.id },
        data: { plan: { ...plan, qualityCheck, policyAcknowledged: false } },
      })
      return NextResponse.json(
        { ok: false, error: { code: "PLAN_QUALITY_FAILED", message: qualityCheck.errors[0], details: qualityCheck } },
        { status: 422 },
      )
    }
  }
  const adGroups = (Array.isArray(plan?.adGroups) ? plan.adGroups : []).map((g: any) => ({
    name: String(g?.name || "Ad Group"),
    headlines: (Array.isArray(g?.headlines) ? g.headlines : []).map((h: any) => String(h?.text || h || "")),
    descriptions: (Array.isArray(g?.descriptions) ? g.descriptions : []).map((d: any) => String(d?.text || d || "")),
  }))

  if (adGroups.length === 0) {
    return NextResponse.json({ ok: false, error: "Plan has no ad groups to check" }, { status: 400 })
  }

  const result = await checkPlanPolicy(adGroups)

  await prisma.campaignPlan.update({
    where: { id: planRow.id },
    data: { plan: { ...plan, policyCheck: result, policyAcknowledged: result.status === "PASS" } },
  })

  return NextResponse.json({ ok: true, data: result })
}
