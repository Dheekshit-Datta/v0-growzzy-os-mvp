import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId } from "@/lib/workspace"

export const dynamic = "force-dynamic"

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = await resolveUserId(session.user.id)
    const workspaceId = await getRequestWorkspaceId(userId, req)
    const body = await req.json()

    const existing = await prisma.automationRule.findFirst({
      where: { id: params.id, userId, workspaceId },
      select: { id: true },
    })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const rule = await prisma.automationRule.update({
      where: { id: existing.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.type !== undefined ? { type: body.type } : {}),
        ...(body.conditions !== undefined ? { conditions: body.conditions } : {}),
        ...(body.actions !== undefined ? { actions: body.actions } : {}),
        ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive), active: Boolean(body.isActive) } : {}),
      },
    })

    return NextResponse.json({ ok: true, rule })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to update automation" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = await resolveUserId(session.user.id)
    const workspaceId = await getRequestWorkspaceId(userId, req)

    const existing = await prisma.automationRule.findFirst({
      where: { id: params.id, userId, workspaceId },
      select: { id: true },
    })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
    await prisma.automationRule.delete({ where: { id: existing.id } })

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to delete automation" }, { status: 500 })
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = await resolveUserId(session.user.id)
    const workspaceId = await getRequestWorkspaceId(userId, req)

    const rule = await prisma.automationRule.findFirst({
      where: { id: params.id, userId, workspaceId },
      include: {
        logs: {
          take: 10,
          orderBy: { triggeredAt: "desc" },
        },
      },
    })

    if (!rule) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ ok: true, rule })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load automation" }, { status: 500 })
  }
}
