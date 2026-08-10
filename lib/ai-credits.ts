import { prisma } from "@/lib/prisma"

const DEFAULT_CREDITS_PER_USD = 0.001
const MODEL_PRICES_PER_1K: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "gpt-4o": { input: 0.0025, output: 0.01 },
}

export class CreditQuotaError extends Error {
  code = "CREDIT_QUOTA_EXCEEDED"
  status = 402
}

function creditsPerUsd() {
  const value = Number(process.env.CREDIT_PER_USD)
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_CREDITS_PER_USD
}

export function creditsForUsage(model: string, inputTokens = 0, outputTokens = 0) {
  const price = MODEL_PRICES_PER_1K[model] || MODEL_PRICES_PER_1K["gpt-4o"]
  const costUsd = (inputTokens / 1000) * price.input + (outputTokens / 1000) * price.output
  return { costUsd, credits: Math.max(1, Math.ceil(costUsd / creditsPerUsd())) }
}

export function estimatedCredits(model: string) {
  return creditsForUsage(model, 2000, 1000).credits
}

export function creditResetDate(year: number, month: number, day: number) {
  const lastDay = new Date(year, month + 1, 0).getDate()
  return new Date(year, month, Math.min(Math.max(day, 1), lastDay))
}

export async function assertCreditsAvailable(workspaceId: string, estimated: number) {
  try {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true },
    })
    return workspace
  } catch (error: any) {
    if (error instanceof CreditQuotaError) throw error
    console.warn("Credit check bypassed:", error?.message || error)
    return null
  }
}

export async function recordCreditUsage(input: {
  workspaceId: string
  userId: string
  route: string
  model: string
  inputTokens?: number
  outputTokens?: number
}) {
  const inputTokens = input.inputTokens || 0
  const outputTokens = input.outputTokens || 0
  const usage = creditsForUsage(input.model, inputTokens, outputTokens)
  if (usage.credits <= 0) return usage

  try {
    await prisma.creditUsageLog.create({
      data: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        route: input.route,
        model: input.model,
        inputTokens,
        outputTokens,
        credits: usage.credits,
        costUsd: usage.costUsd,
      },
    })
  } catch (error) {
    console.warn("Could not log credit usage:", error)
  }
  return usage
}

export async function recordFixedCreditUsage(input: {
  workspaceId: string
  userId: string
  route: string
  model: string
  credits: number
}) {
  const credits = Math.max(1, Math.ceil(input.credits))
  try {
    await prisma.creditUsageLog.create({
      data: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        route: input.route,
        model: input.model,
        inputTokens: 0,
        outputTokens: 0,
        credits,
        costUsd: credits * DEFAULT_CREDITS_PER_USD,
      },
    })
  } catch (error) {
    console.warn("Could not log fixed credit usage:", error)
  }
  return { costUsd: credits * DEFAULT_CREDITS_PER_USD, credits }
}

export async function resetDueWorkspaceCredits() {
  try {
    const now = new Date()
    const currentDay = now.getDate()
    return { count: 0 }
  } catch (error) {
    console.warn("resetDueWorkspaceCredits skipped:", error)
    return { count: 0 }
  }
}
