import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"

export const dynamic = "force-dynamic"

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = await resolveUserId(session.user.id)
  const adSet = await prisma.adSet.findFirst({ where: { id: params.id, userId } })
  if (!adSet) return NextResponse.json({ error: "Ad set not found" }, { status: 404 })
  await prisma.adSet.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
