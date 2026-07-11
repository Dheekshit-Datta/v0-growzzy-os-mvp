import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"

type RuleCondition = {
  metric?: "roas" | "spend_budget_ratio" | "conversion_drop"
  operator?: "lt" | "gt" | "lte" | "gte"
  value?: number
}

type RuleAction = {
  type?: "email" | "pause_campaign" | "send_report"
  config?: Record<string, unknown>
}

function compare(operator: string, left: number, right: number) {
  if (operator === "lt") return left < right
  if (operator === "gt") return left > right
  if (operator === "lte") return left <= right
  if (operator === "gte") return left >= right
  return false
}

async function executeRule(rule: {
  id: string
  userId: string
  name: string
  type: string
  conditions: unknown
  actions: unknown
}) {
  const condition = (rule.conditions || {}) as RuleCondition
  const action = (rule.actions || {}) as RuleAction
  const user = await prisma.user.findUnique({
    where: { id: rule.userId },
    select: { id: true, email: true, name: true },
  })

  if (!user) return { triggered: false, details: "User missing" }

  const campaigns = await prisma.campaign.findMany({
    where: { userId: rule.userId },
    orderBy: { spend: "desc" },
  })

  let triggeredCampaigns: Array<{ id: string; name: string; value: number }> = []
  let details = "No trigger"

  if (rule.type === "LOW_ROAS_ALERT") {
    const threshold = Number(condition.value ?? 2)
    triggeredCampaigns = campaigns
      .filter((campaign) => Number(campaign.roas || 0) < threshold)
      .map((campaign) => ({
        id: campaign.id,
        name: campaign.name,
        value: Number(campaign.roas || 0),
      }))
    details = triggeredCampaigns.length
      ? `ROAS below ${threshold} for ${triggeredCampaigns.map((c) => c.name).join(", ")}`
      : details
  } else if (rule.type === "BUDGET_PACING") {
    const threshold = Number(condition.value ?? 1.1)
    triggeredCampaigns = campaigns
      .map((campaign) => ({
        campaign,
        ratio: campaign.budgetAmount ? Number(campaign.spend || 0) / Number(campaign.budgetAmount || 1) : 0,
      }))
      .filter((entry) => entry.ratio > threshold)
      .map((entry) => ({
        id: entry.campaign.id,
        name: entry.campaign.name,
        value: Number(entry.ratio.toFixed(2)),
      }))
    details = triggeredCampaigns.length
      ? `Budget pacing above ${threshold} for ${triggeredCampaigns.map((c) => c.name).join(", ")}`
      : details
  } else if (rule.type === "CONVERSION_DROP") {
    const threshold = Number(condition.value ?? 0.2)
    triggeredCampaigns = campaigns
      .map((campaign) => {
        const daily = campaign.rawData && typeof campaign.rawData === "object"
          ? ((campaign.rawData as Record<string, any>).dailyConversions as number[] | undefined)
          : undefined
        if (!daily || daily.length < 14) return null
        const thisWeek = daily.slice(-7).reduce((sum, value) => sum + Number(value || 0), 0)
        const prevWeek = daily.slice(-14, -7).reduce((sum, value) => sum + Number(value || 0), 0)
        if (prevWeek <= 0) return null
        const drop = (prevWeek - thisWeek) / prevWeek
        return { campaign, drop }
      })
      .filter((entry): entry is { campaign: (typeof campaigns)[number]; drop: number } => Boolean(entry))
      .filter((entry) => entry.drop > threshold)
      .map((entry) => ({
        id: entry.campaign.id,
        name: entry.campaign.name,
        value: Number((entry.drop * 100).toFixed(2)),
      }))
    details = triggeredCampaigns.length
      ? `Conversion drop over ${(threshold * 100).toFixed(0)}% for ${triggeredCampaigns
          .map((c) => c.name)
          .join(", ")}`
      : details
  } else if (rule.type === "WEEKLY_REPORT") {
    const now = new Date()
    const isMonday = now.getDay() === 1
    const isAfterNineAm = now.getHours() >= 9
    if (isMonday && isAfterNineAm) {
      details = "Weekly report schedule window reached"
      triggeredCampaigns = campaigns.slice(0, 1).map((campaign) => ({
        id: campaign.id,
        name: campaign.name,
        value: Number(campaign.spend || 0),
      }))
    }
  }

  const triggered = triggeredCampaigns.length > 0
  if (!triggered) return { triggered: false, details }

  const actionType = action.type || "email"
  if (actionType === "email" || actionType === "send_report") {
    const subject =
      rule.type === "WEEKLY_REPORT" ? "GrowzzyOS Weekly Campaign Report" : `GrowzzyOS Automation Alert: ${rule.name}`
    const html = `
      <div style="font-family:Arial,sans-serif;">
        <h2>${rule.name}</h2>
        <p>${details}</p>
        <ul>
          ${triggeredCampaigns
            .map((item) => `<li><strong>${item.name}</strong> — ${item.value}</li>`)
            .join("")}
        </ul>
      </div>
    `
    await sendEmail({
      to: user.email,
      subject,
      html,
      text: `${rule.name}\n${details}`,
    })
  } else if (actionType === "pause_campaign") {
    details = `${details} Destructive automation action queued for approval; no campaign was changed automatically.`
  }

  return { triggered: true, details }
}

export async function runAutomationsForUser(userId: string) {
  const rules = await prisma.automationRule.findMany({
    where: {
      userId,
      OR: [{ isActive: true }, { active: true }],
    },
    orderBy: { createdAt: "asc" },
  })

  for (const rule of rules) {
    try {
      const outcome = await executeRule({
        id: rule.id,
        userId: rule.userId,
        name: rule.name,
        type: rule.type,
        conditions: rule.conditions,
        actions: rule.actions,
      })

      await prisma.automationRuleLog.create({
        data: {
          ruleId: rule.id,
          userId: rule.userId,
          result: outcome.triggered ? "SUCCESS" : "SKIPPED",
          details: outcome.details,
        },
      })

      if (outcome.triggered) {
        await prisma.automationRule.update({
          where: { id: rule.id },
          data: {
            lastTriggered: new Date(),
            triggerCount: { increment: 1 },
          },
        })
      }
    } catch (error: any) {
      await prisma.automationRuleLog.create({
        data: {
          ruleId: rule.id,
          userId: rule.userId,
          result: "FAILED",
          details: error?.message || "Unknown automation error",
        },
      })
    }
  }

  return { count: rules.length }
}

export const automationEngine = {
  async start() {
    return { ok: true, message: "Automation engine uses cron-based execution in production." }
  },
  async stop() {
    return { ok: true, message: "No in-process scheduler active. Cron remains source of truth." }
  },
}
