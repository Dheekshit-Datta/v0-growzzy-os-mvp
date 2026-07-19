import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId } from "@/lib/workspace"

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = await resolveUserId(session.user.id)
  const workspaceId = await getRequestWorkspaceId(userId, req)
  const existing = await prisma.adGroup.findFirst({
    where: { id: params.id, userId, campaign: { workspaceId } },
  })
  if (!existing) return NextResponse.json({ error: "Ad group not found" }, { status: 404 })
  await prisma.adGroup.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
