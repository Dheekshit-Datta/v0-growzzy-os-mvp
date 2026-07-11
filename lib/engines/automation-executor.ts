import { prisma } from "@/lib/prisma"

export type ActionType =
  | "budget_increase"
  | "budget_decrease"
  | "campaign_pause"
  | "campaign_activate"
  | "creative_flag"

export interface ExecutionResult {
  success: boolean
  actionTaken: string
  before: Record<string, unknown>
  after: Record<string, unknown>
  rollbackAvailable: boolean
  message: string
}

const MAX_BUDGET_CHANGE_PCT = 0.3

export async function executeBudgetChange(
  campaignId: string,
  userId: string,
  automationId: string,
  targetDailyBudget: number
): Promise<ExecutionResult> {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, userId },
    select: { id: true, dailyBudget: true },
  })
  if (!campaign) {
    return { success: false, actionTaken: "budget_change", before: {}, after: {}, rollbackAvailable: false, message: "Campaign not found" }
  }

  const currentBudget = Number(campaign.dailyBudget || 0)
  const maxBudget = currentBudget ? currentBudget * (1 + MAX_BUDGET_CHANGE_PCT) : targetDailyBudget
  const minBudget = currentBudget ? currentBudget * (1 - MAX_BUDGET_CHANGE_PCT) : targetDailyBudget
  const safeBudget = Math.min(maxBudget, Math.max(minBudget, targetDailyBudget))
  const before = { dailyBudget: currentBudget }
  const after = { dailyBudget: safeBudget }
  const actionTaken = `budget_change:${campaignId}:${safeBudget.toFixed(0)}`

  await prisma.automationLog.create({
    data: {
      automationId,
      actionTaken,
      result: JSON.stringify({ before, after, approvalRequired: true }),
      success: false,
      impact: "Budget change queued for approval; no live campaign was modified.",
    },
  })

  return {
    success: false,
    actionTaken,
    before,
    after,
    rollbackAvailable: false,
    message: "Automation budget changes require explicit approval through AI Advisor preview/apply.",
  }
}

export async function executeCampaignStatusChange(
  campaignId: string,
  userId: string,
  automationId: string,
  newStatus: "paused" | "active"
): Promise<ExecutionResult> {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, userId },
    select: { id: true, status: true },
  })
  if (!campaign) {
    return { success: false, actionTaken: "status_change", before: {}, after: {}, rollbackAvailable: false, message: "Campaign not found" }
  }

  const before = { status: campaign.status }
  const after = { status: newStatus }
  const actionTaken = `status_change:${campaignId}:${newStatus}`

  await prisma.automationLog.create({
    data: {
      automationId,
      actionTaken,
      result: JSON.stringify({ before, after, approvalRequired: true }),
      success: false,
      impact: "Campaign status change queued for approval; no live campaign was modified.",
    },
  })

  return {
    success: false,
    actionTaken,
    before,
    after,
    rollbackAvailable: false,
    message: "Automation status changes require explicit approval through AI Advisor preview/apply.",
  }
}

export async function rollbackLastAction(automationId: string): Promise<ExecutionResult> {
  await prisma.automationLog.create({
    data: {
      automationId,
      actionTaken: "rollback:not_required",
      result: JSON.stringify({ approvalOnly: true }),
      success: false,
      impact: "Rollback skipped because automation actions no longer mutate campaigns directly.",
    },
  })

  return {
    success: false,
    actionTaken: "rollback:not_required",
    before: {},
    after: {},
    rollbackAvailable: false,
    message: "No rollback was needed because automation actions require approval before any provider mutation.",
  }
}

export async function markSuggestion(suggestionId: string, action: "applied" | "dismissed"): Promise<void> {
  await prisma.optimizationSuggestion.update({
    where: { id: suggestionId },
    data: action === "applied" ? { applied: true, dismissed: false } : { dismissed: true, applied: false },
  })
}
