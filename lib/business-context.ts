import { prisma } from "@/lib/prisma"

type BusinessContextInput = {
  name?: string | null
  websiteUrl?: string | null
  primaryGoal?: string | null
  currencyCode?: string | null
  timezone?: string | null
  productDescription?: string | null
  industry?: string | null
  toneOfVoice?: string | null
  dailyBudgetCeiling?: number | null
}

export function formatBusinessContext(workspace: BusinessContextInput | null) {
  if (!workspace) return ""
  const details = [
    workspace.name && `Business: ${workspace.name}`,
    workspace.productDescription && `Confirmed business summary: ${workspace.productDescription}`,
    workspace.websiteUrl && `Website: ${workspace.websiteUrl}`,
    workspace.industry && `Industry: ${workspace.industry}`,
    workspace.toneOfVoice && `Preferred voice: ${workspace.toneOfVoice}`,
    workspace.primaryGoal && `Primary goal: ${workspace.primaryGoal}`,
    workspace.currencyCode && `Currency: ${workspace.currencyCode}`,
    workspace.timezone && `Timezone: ${workspace.timezone}`,
    workspace.dailyBudgetCeiling && `Approved daily budget ceiling: ${workspace.dailyBudgetCeiling}`,
  ].filter(Boolean)
  return details.length ? `\nThis business has confirmed the following context. Use it when relevant and never invent facts beyond it:\n${details.join("\n")}` : ""
}

export async function getBusinessContextForWorkspace(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      name: true,
      websiteUrl: true,
      primaryGoal: true,
      currencyCode: true,
      timezone: true,
      productDescription: true,
      industry: true,
      toneOfVoice: true,
      dailyBudgetCeiling: true,
    },
  })
  return formatBusinessContext(workspace)
}
