import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"

export const dynamic = "force-dynamic"

/** GET /api/ai/conversations — list user's conversations */
export async function GET(_req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }
    const userId = await resolveUserId(session.user.id)
    const conversations = await prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    })
    return NextResponse.json({ ok: true, conversations })
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed to list conversations" }, { status: 500 })
  }
}
