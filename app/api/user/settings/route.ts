import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = await resolveUserId(session.user.id)
  let settings = await prisma.userSettings.findUnique({ where: { userId } })
  if (!settings) {
    try {
      settings = await prisma.userSettings.create({ data: { userId, primaryKpi: "ROAS", riskLevel: "BALANCED" } })
    } catch (error: any) {
      if (error?.code === "P2002") {
        settings = await prisma.userSettings.findUnique({ where: { userId } })
      } else {
        throw error
      }
    }
  }
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
      ...(body.primaryKpi !== undefined ? { primaryKpi: body.primaryKpi } : {}),
      ...(body.kpiTarget !== undefined ? { kpiTarget: body.kpiTarget == null ? null : Number(body.kpiTarget) } : {}),
      ...(body.riskLevel !== undefined ? { riskLevel: body.riskLevel } : {}),
      ...(body.targetRoas !== undefined ? { targetRoas: body.targetRoas == null ? null : Number(body.targetRoas) } : {}),
      ...(body.maxCpa !== undefined ? { maxCpa: body.maxCpa == null ? null : Number(body.maxCpa) } : {}),
      ...(body.notificationPrefs !== undefined ? { notificationPrefs: body.notificationPrefs } : {}),
    },
    create: {
      userId,
      primaryKpi: body.primaryKpi || "ROAS",
      kpiTarget: body.kpiTarget == null ? null : Number(body.kpiTarget),
      riskLevel: body.riskLevel || "BALANCED",
      targetRoas: body.targetRoas == null ? null : Number(body.targetRoas),
      maxCpa: body.maxCpa == null ? null : Number(body.maxCpa),
      notificationPrefs: body.notificationPrefs ?? undefined,
    },
  })
  return NextResponse.json({ ok: true, settings })
}
