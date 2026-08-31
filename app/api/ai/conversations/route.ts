import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { rateLimitPolicy, rateLimitResponse } from "@/lib/rate-limit"
import { getRequestWorkspaceId } from "@/lib/workspace"

export const dynamic = "force-dynamic"

/** GET /api/ai/conversations — list user's conversations */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }
    const userId = await resolveUserId(session.user.id)
    const limit = await rateLimitPolicy(userId, "aiUtility")
    if (!limit.allowed) return rateLimitResponse(limit)
    const workspaceId = await getRequestWorkspaceId(userId, req)

    const conversations = await prisma.conversation.findMany({
      where: { userId, workspaceId },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    })
    return NextResponse.json({ ok: true, conversations })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed to list conversations" }, { status: 500 })
  }
}
