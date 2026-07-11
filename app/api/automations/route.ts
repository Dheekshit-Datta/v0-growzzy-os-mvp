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
    const rules = await prisma.automationRule.findMany({
      where: { userId, workspaceId },
      include: {
        logs: {
          take: 10,
          orderBy: { triggeredAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ ok: true, rules })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load automations" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = await resolveUserId(session.user.id)
    const workspaceId = await getRequestWorkspaceId(userId, req)
    const body = await req.json()

    if (!body?.name || !body?.type) {
      return NextResponse.json({ error: "name and type are required" }, { status: 400 })
    }

    const rule = await prisma.automationRule.create({
      data: {
        userId,
        workspaceId,
        name: body.name,
        description: body.description || "",
        type: body.type,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
        conditions: body.conditions || {},
        actions: body.actions || { type: "email", config: {} },
      },
    })

    return NextResponse.json({ ok: true, rule }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to create automation" }, { status: 500 })
  }
}
