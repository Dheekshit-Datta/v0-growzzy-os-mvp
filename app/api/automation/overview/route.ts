import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId } from "@/lib/workspace"

export const dynamic = "force-dynamic"

function normalizeAction(actions: unknown, fallback?: string | null) {
  if (actions && typeof actions === "object" && "type" in actions) {
    return String((actions as { type?: unknown }).type || fallback || "alert")
  }
  return fallback || "alert"
}

function estimateImpact(logs: Array<{ details: string; result: string }>) {
  return logs.reduce(
    (totals, log) => {
      const text = `${log.result} ${log.details}`.toLowerCase()
      const dollarMatch = text.match(/\$([0-9,]+(?:\.[0-9]+)?)/)
      const amount = dollarMatch ? Number(dollarMatch[1].replace(/,/g, "")) : 0
      if (text.includes("save") || text.includes("saved") || text.includes("waste")) totals.saved += amount
      if (text.includes("gain") || text.includes("revenue") || text.includes("won")) totals.won += amount
      return totals
    },
    { saved: 0, won: 0 }
  )
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = await resolveUserId(session.user.id)
  const workspaceId = await getRequestWorkspaceId(userId, req)
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const rules = await prisma.automationRule.findMany({
    where: { userId, workspaceId },
    orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
    include: {
      logs: {
        where: { triggeredAt: { gte: since } },
        orderBy: { triggeredAt: "desc" },
        take: 100,
      },
    },
    take: 100,
  })

  const allLogs = rules.flatMap((rule) => rule.logs)
  const impact = estimateImpact(allLogs)
  const actionCounts = rules.reduce<Record<string, number>>((counts, rule) => {
    const action = normalizeAction(rule.actions, rule.action).toLowerCase()
    counts[action] = (counts[action] || 0) + rule.logs.length
    return counts
  }, {})

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - index))
    const key = date.toISOString().slice(0, 10)
    return {
      date: key,
      actions: allLogs.filter((log) => log.triggeredAt.toISOString().slice(0, 10) === key).length,
    }
  })

  return NextResponse.json({
    ok: true,
    workspaceId,
    summary: {
      activeRules: rules.filter((rule) => rule.isActive).length,
      totalRules: rules.length,
      totalActions: allLogs.length,
      pauseActions: actionCounts.pause_campaign || actionCounts.pause || actionCounts["pause ad set"] || 0,
      budgetIncreaseActions: actionCounts.increase_budget || actionCounts["increase budget"] || 0,
      budgetDecreaseActions: actionCounts.decrease_budget || actionCounts["reduce budget 25%"] || 0,
      alertsSent: actionCounts.email || actionCounts.alert || actionCounts.send_alert || 0,
      estimatedSaved: impact.saved,
      estimatedWon: impact.won,
      automationCoveragePct: rules.length ? Math.round((rules.filter((rule) => rule.isActive).length / rules.length) * 100) : 0,
    },
    frequency: days,
    rules: rules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      status: rule.isActive ? "ACTIVE" : "PAUSED",
      isActive: rule.isActive,
      tacticName: rule.name,
      author: "GROWZZY OS",
      conditions: rule.conditions,
      actions: rule.actions,
      affectedAssets: rule.triggerCount || rule.logs.length,
      actionFrequency: days.map((day) => ({
        date: day.date,
        count: rule.logs.filter((log) => log.triggeredAt.toISOString().slice(0, 10) === day.date).length,
      })),
      lastTriggered: rule.lastTriggered,
      triggerCount: rule.triggerCount,
      logs: rule.logs,
    })),
    trust: {
      source: "AutomationRule and AutomationRuleLog records only",
      noSyntheticImpact: true,
    },
  })
}
