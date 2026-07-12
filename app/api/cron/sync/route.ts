import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { syncGoogleAdsCampaigns } from "@/lib/sync-engine"
import { runAutomationsForUser } from "@/lib/automation-engine"
import { sendEmail } from "@/lib/email"
import { log } from "@/lib/logger"
import { validateEnv } from "@/lib/env"
import { normalizeReportType, renderReportHtml } from "@/lib/report-template-renderer"
import { getIntegrationAccessToken } from "@/lib/integration-tokens"

export const dynamic = "force-dynamic"
export const maxDuration = 300

type CronSyncError = {
  integrationId: string
  userId: string
  platform: string
  error: string
}

function shouldSendScheduledReport(schedule: { frequency: string; dayOfWeek: number | null; lastSent: Date | null }) {
  const now = new Date()
  const hour = now.getHours()
  const minute = now.getMinutes()
  const inWindow = hour === 9 && minute < 10
  if (!inWindow) return false

  const lastSent = schedule.lastSent
  if (schedule.frequency === "DAILY") {
    return !lastSent || lastSent.toDateString() !== now.toDateString()
  }
  if (schedule.frequency === "WEEKLY") {
    if (schedule.dayOfWeek !== null && now.getDay() !== schedule.dayOfWeek) return false
    if (!lastSent) return true
    const diffDays = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60 * 24)
    return diffDays >= 7
  }
  if (schedule.frequency === "MONTHLY") {
    if (!lastSent) return true
    return now.getMonth() !== lastSent.getMonth() || now.getFullYear() !== lastSent.getFullYear()
  }
  return false
}

export async function GET(req: Request) {
  validateEnv()

  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const startedAt = Date.now()
  log("info", "cron/sync", "Cron sync started")

  const integrations = await prisma.integration.findMany({
    where: {
      hasAdsAccess: true,
      status: "ACTIVE",
      platform: "GOOGLE",
    },
    include: {
      adAccounts: true,
    },
  })

  let synced = 0
  const errors: CronSyncError[] = []
  const automationUsers = new Set<string>()

  for (const integration of integrations) {
    const primary = integration.adAccounts.find((a) => a.isPrimary) || integration.adAccounts[0]
    if (!primary) {
      errors.push({
        integrationId: integration.id,
        userId: integration.userId,
        platform: integration.platform,
        error: "Primary ad account not found",
      })
      continue
    }

    try {
      if (integration.platform !== "GOOGLE") continue
      const accessToken = getIntegrationAccessToken(integration)
      if (!accessToken) throw new Error("Missing Google access token")
      await syncGoogleAdsCampaigns(
        integration.userId,
        integration.id,
        primary.id,
        primary.externalId,
        accessToken,
        primary.managerCustomerId
      )

      await prisma.integration.update({
        where: { id: integration.id },
        data: {
          lastSyncedAt: new Date(),
          syncStatus: "SYNCED",
          lastSyncStatus: "SUCCESS",
          lastSyncError: null,
        },
      })
      synced += 1
      automationUsers.add(integration.userId)
    } catch (error: any) {
      log("error", "cron/sync", "Integration sync failed", {
        userId: integration.userId,
        platform: integration.platform,
        message: error?.message,
      })
      await prisma.integration.update({
        where: { id: integration.id },
        data: {
          syncStatus: "ERROR",
          lastSyncStatus: "FAILED",
          lastSyncError: error?.message || "Unknown sync error",
        },
      })
      errors.push({
        integrationId: integration.id,
        userId: integration.userId,
        platform: integration.platform,
        error: error?.message || "Unknown sync error",
      })
    }
  }

  for (const userId of automationUsers) {
    try {
      await runAutomationsForUser(userId)
    } catch (error: any) {
      log("error", "cron/sync", "Automation run failed", { userId, message: error?.message })
      errors.push({
        integrationId: "automation",
        userId,
        platform: "AUTOMATION",
        error: error?.message || "Automation run failed",
      })
    }
  }

  const schedules = await prisma.scheduledReport.findMany({
    where: { isActive: true },
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
  })

  for (const schedule of schedules) {
    try {
      if (!shouldSendScheduledReport(schedule)) continue
      const rendered = await renderReportHtml({
        userId: schedule.userId,
        accountName: schedule.user.name || schedule.user.email,
        type: normalizeReportType(schedule.templateType),
      })

      await sendEmail({
        to: schedule.sendTo || schedule.user.email,
        subject: `GrowzzyOS Report: ${schedule.name}`,
        html: rendered.html,
      })

      await prisma.scheduledReport.update({
        where: { id: schedule.id },
        data: { lastSent: new Date() },
      })
    } catch (error: any) {
      log("error", "cron/sync", "Scheduled report failed", { userId: schedule.userId, scheduleId: schedule.id, message: error?.message })
      errors.push({
        integrationId: `schedule:${schedule.id}`,
        userId: schedule.userId,
        platform: "REPORTS",
        error: error?.message || "Scheduled report send failed",
      })
    }
  }

  const result = {
    ok: true,
    totalIntegrations: integrations.length,
    synced,
    failed: errors.length,
    errors,
    runAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
  }

  log("info", "cron/sync", "Cron sync completed", result)
  return NextResponse.json(result)
}
