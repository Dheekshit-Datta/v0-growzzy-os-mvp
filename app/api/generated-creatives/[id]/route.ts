import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { log } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId, workspaceWhere } from "@/lib/workspace"
import { getActiveAdAccountScope } from "@/lib/account-scope"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = await resolveUserId(session.user.id)
    const workspaceId = await getRequestWorkspaceId(userId, req)
    const scope = await getActiveAdAccountScope(userId, workspaceId, req.nextUrl.searchParams.get("adAccountId"))
    if (!scope) return NextResponse.json({ error: "Select an ad account before loading creatives." }, { status: 409 })

    const creative = await prisma.generatedCreative.findFirst({
      where: {
        id: params.id,
        userId,
        ...workspaceWhere(workspaceId, false),
        adAccountId: scope.adAccountId,
      },
    })

    if (!creative) return NextResponse.json({ error: "Creative not found" }, { status: 404 })
    return NextResponse.json({ ok: true, creative })
  } catch (error: any) {
    log("error", "api/generated-creatives/get", "Failed to load generated creative", { message: error?.message })
    return NextResponse.json({ error: "Failed to load creative" }, { status: 500 })
  }
}
