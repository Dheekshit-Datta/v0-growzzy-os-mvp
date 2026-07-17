import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { log } from "@/lib/logger"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId } from "@/lib/workspace"

export const dynamic = "force-dynamic"

export async function GET(_req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = await resolveUserId(session.user.id)
    const workspaceId = await getRequestWorkspaceId(userId, _req)
    const integration = await prisma.integration.findFirst({
      where: { userId, workspaceId, platform: "GOOGLE", status: { in: ["OAUTH_GRANTED", "ACCOUNT_SELECTED", "INITIAL_SYNC_RUNNING", "ACTIVE", "SYNC_FAILED"] }, hasAdsAccess: true },
      select: { selectedAdAccountId: true, accountId: true },
    })
    const adAccountId = integration?.selectedAdAccountId || integration?.accountId || null

    const audits = await prisma.accountAudit.findMany({
      where: { userId, workspaceId, ...(adAccountId ? { adAccountId } : { id: "__none__" }) },
      orderBy: { createdAt: "desc" },
      take: 5,
    })

    return NextResponse.json({ ok: true, audits })
  } catch (error: any) {
    log("error", "api/ai/audits", "Failed to list audits", { message: error?.message })
    return NextResponse.json({ error: "Failed to load audit history" }, { status: 500 })
  }
}
