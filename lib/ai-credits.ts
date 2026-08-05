import { prisma } from "@/lib/prisma"

const DEFAULT_CREDITS_PER_USD = 0.001
const MODEL_PRICES_PER_1K: Record<string, { input: number; output: number }> = {
  "gpt-5-mini": { input: 0.00025, output: 0.002 },
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

export async function assertCreditsAvailable(workspaceId: string, estimated: number) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { monthlyCredits: true, usedCreditsThisMonth: true },
  })
  if (!workspace) throw new Error("Workspace not found")
  if (workspace.usedCreditsThisMonth + estimated > workspace.monthlyCredits) {
    throw new CreditQuotaError("Monthly credit quota exceeded")
  }
  return workspace
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

  await prisma.$transaction(async (tx) => {
    const updated = await tx.$executeRaw`
      UPDATE "Workspace"
      SET "usedCreditsThisMonth" = "usedCreditsThisMonth" + ${usage.credits}
      WHERE "id" = ${input.workspaceId}
        AND "usedCreditsThisMonth" + ${usage.credits} <= "monthlyCredits"
    `
    if (updated !== 1) throw new CreditQuotaError("Monthly credit quota exceeded")
    await tx.creditUsageLog.create({
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
  })
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
  await prisma.$transaction(async (tx) => {
    const updated = await tx.$executeRaw`
      UPDATE "Workspace"
      SET "usedCreditsThisMonth" = "usedCreditsThisMonth" + ${credits}
      WHERE "id" = ${input.workspaceId}
        AND "usedCreditsThisMonth" + ${credits} <= "monthlyCredits"
    `
    if (updated !== 1) throw new CreditQuotaError("Monthly credit quota exceeded")
    await tx.creditUsageLog.create({
      data: { workspaceId: input.workspaceId, userId: input.userId, route: input.route, model: input.model, credits },
    })
  })
  return credits
}

export async function resetDueWorkspaceCredits(now = new Date()) {
  const workspaces = await prisma.workspace.findMany({
    where: { usedCreditsThisMonth: { gt: 0 } },
    select: { id: true, creditResetDay: true, creditResetAt: true },
  })
  let count = 0
  for (const workspace of workspaces) {
    const day = Math.min(Math.max(workspace.creditResetDay, 1), 28)
    const resetThisMonth = new Date(now.getFullYear(), now.getMonth(), day)
    const resetAt = now >= resetThisMonth ? resetThisMonth : new Date(now.getFullYear(), now.getMonth() - 1, day)
    if (workspace.creditResetAt && workspace.creditResetAt >= resetAt) continue
    const result = await prisma.workspace.updateMany({
      where: { id: workspace.id, creditResetAt: workspace.creditResetAt },
      data: { usedCreditsThisMonth: 0, creditResetAt: resetAt },
    })
    count += result.count
  }
  return { count }
}
