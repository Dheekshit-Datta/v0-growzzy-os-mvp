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

  const [workspace, googleConnected, campaignCount] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { productDescription: true, industry: true } }),
    prisma.integration.findFirst({
      where: { userId, workspaceId, platform: "GOOGLE", hasAdsAccess: true, status: { in: ["OAUTH_GRANTED", "ACCOUNT_SELECTED", "INITIAL_SYNC_RUNNING", "ACTIVE", "SYNC_FAILED"] } },
      select: { id: true },
    }),
    prisma.campaign.count({ where: { userId, workspaceId } }),
  ])

  const steps = {
    accountCreated: true,
    brandConfigured: !!(workspace?.productDescription || workspace?.industry),
    googleConnected: !!googleConnected,
    firstCampaign: campaignCount > 0,
  }
  const doneCount = Object.values(steps).filter(Boolean).length
  const progress = Math.round((doneCount / Object.keys(steps).length) * 100)

  return NextResponse.json({ ok: true, steps, progress })
}
