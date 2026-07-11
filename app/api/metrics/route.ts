import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { log } from "@/lib/logger"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.METRICS_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const now = new Date()
    const dayStart = new Date(now)
    dayStart.setHours(0, 0, 0, 0)
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000)

    const [totalUsers, activeIntegrations, campaignsSyncedToday, syncErrorsLastHour, automationsTriggeredToday] = await Promise.all([
      prisma.user.count(),
      prisma.integration.count({ where: { hasAdsAccess: true, status: "ACTIVE" } }),
      prisma.campaign.count({ where: { syncedAt: { gte: dayStart } } }),
      prisma.integration.count({
        where: {
          updatedAt: { gte: hourAgo },
          OR: [{ syncStatus: "ERROR" }, { lastSyncStatus: "FAILED" }, { lastSyncStatus: "ACCESS_DENIED" }],
        },
      }),
      prisma.automationRuleLog.count({ where: { triggeredAt: { gte: dayStart } } }),
    ])

    return NextResponse.json({
      timestamp: now.toISOString(),
      totalUsers,
      activeIntegrations,
      campaignsSyncedToday,
      syncErrorsLastHour,
      automationsTriggeredToday,
    })
  } catch (error: any) {
    log("error", "api/metrics", "Metrics endpoint failed", { message: error?.message })
    return NextResponse.json({ error: "Failed to load metrics" }, { status: 500 })
  }
}
