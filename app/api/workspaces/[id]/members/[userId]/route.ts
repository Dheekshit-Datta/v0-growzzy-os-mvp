import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function DELETE(_req: Request, { params }: { params: { id: string; userId: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = await prisma.workspaceMember.findFirst({
    where: { workspaceId: params.id, userId: session.user.id, role: { in: ["ADMIN", "OWNER"] } },
  })
  if (!admin) return NextResponse.json({ error: "Workspace admin access required" }, { status: 403 })
  if (params.userId === session.user.id) return NextResponse.json({ error: "You cannot remove yourself" }, { status: 400 })

  await prisma.workspaceMember.deleteMany({ where: { workspaceId: params.id, userId: params.userId } })
  return NextResponse.json({ ok: true })
}
