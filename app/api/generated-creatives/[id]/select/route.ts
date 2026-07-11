import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId, workspaceWhere } from "@/lib/workspace"
import { log } from "@/lib/logger"
import { getActiveAdAccountScope } from "@/lib/account-scope"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = await resolveUserId(session.user.id)
    const workspaceId = await getRequestWorkspaceId(userId, req)
    const body = await req.json().catch(() => ({}))
    const selectedIndex = Math.max(0, Number(body.selectedIndex || 0))
    const scope = await getActiveAdAccountScope(userId, workspaceId, body.adAccountId)
    if (!scope) return NextResponse.json({ error: "Select an ad account before selecting creatives." }, { status: 409 })

    const creative = await prisma.generatedCreative.findFirst({
      where: {
        id: params.id,
        userId,
        ...workspaceWhere(workspaceId, false),
        adAccountId: scope.adAccountId,
      },
    })
    if (!creative) return NextResponse.json({ error: "Creative not found" }, { status: 404 })

    const updated = await prisma.generatedCreative.update({
      where: { id: creative.id },
      data: { selectedIndex },
    })

    return NextResponse.json({ ok: true, creative: updated })
  } catch (error: any) {
    log("error", "api/generated-creatives/select", "Failed to select creative", { message: error?.message })
    return NextResponse.json({ error: "Failed to select creative" }, { status: 500 })
  }
}
