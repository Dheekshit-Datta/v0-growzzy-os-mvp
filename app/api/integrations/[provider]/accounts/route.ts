import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId } from "@/lib/workspace"

export async function GET(req: Request, { params }: { params: { provider: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const userId = await resolveUserId(session.user.id)
    const workspaceId = await getRequestWorkspaceId(userId, req as any)
    const integration = await prisma.integration.findFirst({
      where: { userId, workspaceId, platform: params.provider.toUpperCase() as any },
      include: { adAccounts: true },
    })

    if (!integration) return NextResponse.json({ error: `No ${params.provider} connection found` }, { status: 404 })

    return NextResponse.json({
      success: true,
      accounts: integration.adAccounts.map((a) => ({
        externalId: a.externalId,
        id: a.externalId,
        name: a.name,
        managerCustomerId: a.managerCustomerId,
        isManager: a.isManager,
      })),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch accounts" }, { status: 500 })
  }
}
