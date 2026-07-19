import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId, workspaceWhere } from "@/lib/workspace"
import { analyzeAdGroupCreatives } from "@/lib/creative-testing"

interface Params {
  params: { id: string }
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = await resolveUserId(session.user.id)
    const workspaceId = await getRequestWorkspaceId(userId, request)

    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, userId, ...workspaceWhere(workspaceId, false) },
      include: {
        integration: { select: { id: true, platform: true, accountName: true, selectedAdAccountName: true } },
        metricsDaily: { orderBy: { metricDate: "asc" }, take: 90 },
        adGroups: { include: { keywords: true, ads: { include: { metricsDaily: { orderBy: { metricDate: "asc" }, take: 30 } } } } },
        creatives: true,
      },
    })
    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })

    const adGroups = campaign.adGroups.map((group) => {
      const analysis = analyzeAdGroupCreatives(group.ads)
      const analysisByAdId = new Map(analysis.map((a) => [a.adId, a]))
      return {
        ...group,
        ads: group.ads.map((ad) => ({ ...ad, creativeTest: analysisByAdId.get(ad.id) || null })),
      }
    })

    return NextResponse.json({ ok: true, campaign: { ...campaign, adGroups } })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

const PatchCampaignSchema = z.object({
  projectId: z.string().nullable().optional(),
})

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = await resolveUserId(session.user.id)
    const workspaceId = await getRequestWorkspaceId(userId, request)

    const existing = await prisma.campaign.findFirst({ where: { id: params.id, userId, ...workspaceWhere(workspaceId, false) } })
    if (!existing) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })

    const parsed = PatchCampaignSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid update" }, { status: 400 })

    if (parsed.data.projectId) {
      const project = await prisma.project.findFirst({ where: { id: parsed.data.projectId, userId, workspaceId } })
      if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const campaign = await prisma.campaign.update({
      where: { id: existing.id },
      data: { ...(parsed.data.projectId !== undefined ? { projectId: parsed.data.projectId } : {}) },
    })

    return NextResponse.json({ ok: true, campaign })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
