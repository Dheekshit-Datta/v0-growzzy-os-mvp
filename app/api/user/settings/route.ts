import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = await resolveUserId(session.user.id)
  const settings = await prisma.userSettings.upsert({
    where: { userId },
    update: {},
    create: { userId, primaryKpi: "ROAS", riskLevel: "BALANCED" },
  })
  return NextResponse.json({ ok: true, settings })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = await resolveUserId(session.user.id)
  const body = await req.json()
  const settings = await prisma.userSettings.upsert({
    where: { userId },
    update: {
      primaryKpi: body.primaryKpi,
      kpiTarget: body.kpiTarget == null ? null : Number(body.kpiTarget),
      riskLevel: body.riskLevel,
      targetRoas: body.targetRoas == null ? null : Number(body.targetRoas),
      maxCpa: body.maxCpa == null ? null : Number(body.maxCpa),
    },
    create: {
      userId,
      primaryKpi: body.primaryKpi || "ROAS",
      kpiTarget: body.kpiTarget == null ? null : Number(body.kpiTarget),
      riskLevel: body.riskLevel || "BALANCED",
      targetRoas: body.targetRoas == null ? null : Number(body.targetRoas),
      maxCpa: body.maxCpa == null ? null : Number(body.maxCpa),
    },
  })
  return NextResponse.json({ ok: true, settings })
}
