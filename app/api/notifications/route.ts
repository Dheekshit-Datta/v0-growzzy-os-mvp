import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId } from "@/lib/workspace"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = await resolveUserId(session.user.id)
    const workspaceId = await getRequestWorkspaceId(userId, req)
    const [unreadCount, notifications] = await Promise.all([
      prisma.notification.count({ where: { userId, workspaceId, isRead: false } }),
      prisma.notification.findMany({
        where: { userId, workspaceId },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ])

    return NextResponse.json({ unreadCount, notifications })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load notifications" }, { status: 500 })
  }
}
