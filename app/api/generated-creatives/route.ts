import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { log } from "@/lib/logger"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId } from "@/lib/workspace"
import { getActiveAdAccountScope } from "@/lib/account-scope"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = await resolveUserId(session.user.id)
    const workspaceId = await getRequestWorkspaceId(userId, req)
    const scope = await getActiveAdAccountScope(userId, workspaceId, req.nextUrl.searchParams.get("adAccountId"))
    if (!scope) return NextResponse.json({ ok: true, creatives: [], accountRequired: true })

    const creatives = await prisma.generatedCreative.findMany({
      where: {
        userId,
        workspaceId,
        adAccountId: scope.adAccountId,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    })

    return NextResponse.json({ ok: true, creatives, adAccountId: scope.adAccountId })
  } catch (error: any) {
    log("error", "api/generated-creatives", "Failed to list generated creatives", { message: error?.message })
    return NextResponse.json({ error: "Failed to load creative library" }, { status: 500 })
  }
}
