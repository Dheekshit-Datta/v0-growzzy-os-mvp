import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const decision = body?.decision === "DECLINED" ? "DECLINED" : "APPROVED"
  const plan = await prisma.campaignPlan.findFirst({ where: { id, userId: session.user.id } })
  if (!plan) return NextResponse.json({ ok: false, error: "Plan not found" }, { status: 404 })
  const updated = await prisma.campaignPlan.update({ where: { id }, data: { status: decision } })
  return NextResponse.json({ ok: true, status: updated.status })
}
