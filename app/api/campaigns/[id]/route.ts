import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId, workspaceWhere } from "@/lib/workspace"

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
        adGroups: { include: { keywords: true, ads: true } },
        creatives: true,
      },
    })
    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })

    return NextResponse.json({ ok: true, campaign })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
