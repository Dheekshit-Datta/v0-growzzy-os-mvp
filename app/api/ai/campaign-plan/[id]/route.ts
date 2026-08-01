import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId } from "@/lib/workspace"
import { assessGoogleSearchPlan, GoogleAdGroupSchema } from "@/lib/google-plan-quality"

export const dynamic = "force-dynamic"

const PlanPatchSchema = z.object({
  campaignName: z.string().min(1).max(120).optional(),
  objective: z.string().min(1).max(40).optional(),
  dailyBudget: z.coerce.number().positive().max(100000).optional(),
  biddingStrategy: z.enum(["MAXIMIZE_CONVERSIONS", "MAXIMIZE_CLICKS", "TARGET_CPA", "TARGET_ROAS"]).optional(),
  targetCpa: z.coerce.number().positive().optional().nullable(),
  targetRoas: z.coerce.number().positive().optional().nullable(),
  finalUrl: z.string().url().or(z.literal("")).optional(),
  locations: z.array(z.string().max(120)).max(20).optional(),
  languages: z.array(z.string().min(2).max(40)).min(1).max(10).optional(),
  adGroups: z.array(GoogleAdGroupSchema).min(1).max(6).optional(),
  policyAcknowledged: z.boolean().optional(),
})

const MetaPlanPatchSchema = z.object({
  campaignName: z.string().min(1).max(120).optional(),
  dailyBudget: z.coerce.number().positive().max(100000).optional(),
  adSetName: z.string().min(1).max(120).optional(),
  targeting: z.object({
    geo_locations: z.object({ countries: z.array(z.string().regex(/^[A-Z]{2}$/)).min(1).max(25) }),
    age_min: z.coerce.number().int().min(18).max(65).optional(),
    age_max: z.coerce.number().int().min(18).max(65).optional(),
    genders: z.array(z.union([z.literal(1), z.literal(2)])).max(2).optional(),
    interests: z.array(z.object({ id: z.string().regex(/^\d+$/), name: z.string().min(1).max(120) })).max(50).optional(),
  }).optional(),
  placements: z.object({
    publisher_platforms: z.array(z.enum(["facebook", "instagram", "messenger", "audience_network"])).max(4).optional(),
    facebook_positions: z.array(z.enum(["feed", "right_hand_column", "instant_article", "marketplace", "video_feeds", "story", "reels"])).max(7).optional(),
    instagram_positions: z.array(z.enum(["stream", "story", "explore", "reels", "profile_feed"])).max(5).optional(),
  }).optional(),
  pageId: z.string().min(1).optional(),
  instagramActorId: z.string().min(1).nullable().optional(),
  pixelId: z.string().min(1).nullable().optional(),
  appId: z.string().min(1).nullable().optional(),
  objectStoreUrl: z.string().url().nullable().optional(),
  creative: z.object({
    name: z.string().min(1).max(120),
    primaryText: z.string().min(1).max(2200),
    headline: z.string().min(1).max(255),
    description: z.string().max(255).default(""),
    imageUrl: z.string().url(),
    destinationUrl: z.string().url(),
    callToAction: z.string().min(1).max(60),
  }).optional(),
})

async function loadOwnedPlan(req: NextRequest, id: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) }
  const userId = await resolveUserId(session.user.id)
  const workspaceId = await getRequestWorkspaceId(userId, req)
  const planRow = await prisma.campaignPlan.findFirst({ where: { id, userId, workspaceId } })
  if (!planRow) return { error: NextResponse.json({ ok: false, error: "Campaign plan not found" }, { status: 404 }) }
  return { planRow, userId, workspaceId }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const result = await loadOwnedPlan(req, params.id)
  if ("error" in result) return result.error
  return NextResponse.json({ ok: true, data: result.planRow })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const result = await loadOwnedPlan(req, params.id)
  if ("error" in result) return result.error
  const { planRow } = result

  if (planRow.status !== "DRAFT" && planRow.status !== "APPROVED") {
    return NextResponse.json(
      { ok: false, error: `This plan is ${planRow.status.toLowerCase()} and can no longer be edited` },
      { status: 409 }
    )
  }

  const parsed = (planRow.platform === "META" ? MetaPlanPatchSchema : PlanPatchSchema).safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return NextResponse.json(
      { ok: false, error: `${issue?.path?.join(".") || "plan"}: ${issue?.message || "invalid"}` },
      { status: 400 }
    )
  }

  const existingPlan = (planRow.plan as Record<string, unknown>) || {}
  const updates: any = parsed.data
  const mergedPlan: Record<string, unknown> = { ...existingPlan }
  if (updates.campaignName !== undefined) mergedPlan.campaignName = updates.campaignName
  if (updates.objective !== undefined) mergedPlan.objective = updates.objective
  if (updates.dailyBudget !== undefined) mergedPlan.dailyBudget = updates.dailyBudget
  if (updates.biddingStrategy !== undefined) mergedPlan.biddingStrategy = updates.biddingStrategy
  if (updates.targetCpa !== undefined) mergedPlan.targetCpa = updates.targetCpa
  if (updates.targetRoas !== undefined) mergedPlan.targetRoas = updates.targetRoas
  if (updates.finalUrl !== undefined) {
    if (updates.finalUrl) mergedPlan.finalUrl = updates.finalUrl
    else delete mergedPlan.finalUrl
  }
  if (updates.locations !== undefined) mergedPlan.locations = updates.locations
  if (updates.languages !== undefined) mergedPlan.languages = updates.languages
  if (updates.policyAcknowledged !== undefined) mergedPlan.policyAcknowledged = updates.policyAcknowledged
  if (updates.adGroups !== undefined) {
    const adTextChanged = JSON.stringify(existingPlan.adGroups) !== JSON.stringify(updates.adGroups)
    mergedPlan.adGroups = updates.adGroups
    // Ad text changed — any previous policy check is stale
    if (adTextChanged) {
      delete mergedPlan.policyCheck
      mergedPlan.policyAcknowledged = false
    }
  }
  for (const key of ["adSetName", "targeting", "placements", "pageId", "instagramActorId", "pixelId", "appId", "objectStoreUrl", "creative"] as const) {
    if (updates[key] !== undefined) mergedPlan[key] = updates[key]
  }
  if (updates.creative !== undefined) delete mergedPlan.policyCheck

  if (planRow.platform === "GOOGLE") {
    const qualityCheck = assessGoogleSearchPlan(mergedPlan)
    mergedPlan.qualityCheck = qualityCheck
  }

  const updated = await prisma.campaignPlan.update({
    where: { id: planRow.id },
    data: { plan: mergedPlan as any, status: "DRAFT" },
  })

  return NextResponse.json({ ok: true, data: updated })
}
