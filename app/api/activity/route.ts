import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId } from "@/lib/workspace"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = await resolveUserId(session.user.id)
  const workspaceId = await getRequestWorkspaceId(userId, req)
  const requestedAccountId = req.nextUrl.searchParams.get("adAccountId")
  const integration = await prisma.integration.findFirst({
    where: { userId, workspaceId, status: { in: ["OAUTH_GRANTED", "ACCOUNT_SELECTED", "INITIAL_SYNC_RUNNING", "ACTIVE", "SYNC_FAILED"] }, hasAdsAccess: true, ...(requestedAccountId ? { OR: [{ selectedAdAccountId: requestedAccountId }, { accountId: requestedAccountId }] } : {}) },
    select: { selectedAdAccountId: true, accountId: true },
  })
  const adAccountId = integration ? (requestedAccountId || integration.selectedAdAccountId || integration.accountId || null) : null

  const activity = await prisma.activityLog.findMany({
    where: { userId, workspaceId, ...(adAccountId ? { adAccountId } : { id: "__none__" }) },
    orderBy: { createdAt: "desc" },
    take: 25,
  })

  return NextResponse.json({ ok: true, activity })
}
