import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId, workspaceWhere } from "@/lib/workspace"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = await resolveUserId(session.user.id)
    const workspaceId = await getRequestWorkspaceId(userId, req as any)
    const integration = await prisma.integration.findFirst({
      where: { userId, workspaceId, status: { in: ["OAUTH_GRANTED", "ACCOUNT_SELECTED", "INITIAL_SYNC_RUNNING", "ACTIVE", "SYNC_FAILED"] }, hasAdsAccess: true },
      select: { selectedAdAccountId: true, accountId: true },
    })
    const adAccountId = integration?.selectedAdAccountId || integration?.accountId || null

    const reports = await prisma.report.findMany({
      where: { userId, ...workspaceWhere(workspaceId, false), ...(adAccountId ? { adAccountId } : { id: "__none__" }) },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        name: true,
        type: true,
        createdAt: true,
        status: true,
        platforms: true,
        data: true,
        metrics: true,
      },
    })

    return NextResponse.json({
      ok: true,
      reports: reports
        .filter((report) => {
          const metrics = report.metrics as Record<string, unknown> | null
          return metrics?.hasCampaignData === true
        })
        .map((report) => ({
        id: report.id,
        name: report.name,
        type: report.type,
        createdAt: report.createdAt.toISOString(),
        status: report.status,
        platforms: report.platforms,
        html:
          report.data && typeof report.data === "object" && "html" in report.data
            ? String((report.data as Record<string, unknown>).html || "")
            : "",
      })),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load report history" }, { status: 500 })
  }
}
