import { prisma } from "@/lib/prisma"

function normalizeAccountId(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^act_/, "")
    .replace(/[-\s]/g, "")
}

export type ActiveAdAccountScope = {
  integrationId: string
  platform: "GOOGLE" | "META"
  adAccountId: string
  adAccountName: string | null
  hasAdsAccess: boolean
  status: string
  lastSyncedAt: Date | null
}

export async function getActiveAdAccountScope(
  userId: string,
  workspaceId: string,
  requestedAdAccountId?: string | null
): Promise<ActiveAdAccountScope | null> {
  const integrations = await prisma.integration.findMany({
    where: {
      userId,
      workspaceId,
      status: { in: ["ACTIVE", "ACCOUNT_SELECTED", "INITIAL_SYNC_RUNNING", "SYNC_FAILED"] as any },
    },
    select: {
      id: true,
      platform: true,
      status: true,
      hasAdsAccess: true,
      selectedAdAccountId: true,
      selectedAdAccountName: true,
      accountId: true,
      accountName: true,
      lastSyncedAt: true,
      lastSyncAt: true,
      adAccounts: {
        where: { workspaceId },
        select: {
          externalId: true,
          name: true,
          isPrimary: true,
          lastSyncedAt: true,
        },
        orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }],
      },
    },
    orderBy: [{ platform: "asc" }, { updatedAt: "desc" }],
  })

  const candidates = integrations
    .map((integration) => {
      const mappedAccount =
        integration.adAccounts.find((account) => account.externalId === integration.selectedAdAccountId) ||
        integration.adAccounts.find((account) => account.isPrimary) ||
        null
      if (!mappedAccount || !integration.hasAdsAccess) return null
      if (integration.platform !== "GOOGLE" && integration.platform !== "META") return null
      return {
        integrationId: integration.id,
        platform: integration.platform as ActiveAdAccountScope["platform"],
        adAccountId: mappedAccount.externalId,
        adAccountName: mappedAccount.name || null,
        hasAdsAccess: Boolean(integration.hasAdsAccess),
        status: String(integration.status),
        lastSyncedAt: integration.lastSyncedAt || integration.lastSyncAt || mappedAccount.lastSyncedAt || null,
      }
    })
    .filter(Boolean) as ActiveAdAccountScope[]

  if (requestedAdAccountId) {
    const requestedNormalized = normalizeAccountId(requestedAdAccountId)
    return (
      candidates.find((candidate) => normalizeAccountId(candidate.adAccountId) === requestedNormalized) ||
      null
    )
  }

  return candidates.find((candidate) => candidate.platform === "GOOGLE") || candidates[0] || null
}

export async function requireActiveAdAccountScope(
  userId: string,
  workspaceId: string,
  requestedAdAccountId?: string | null
) {
  const scope = await getActiveAdAccountScope(userId, workspaceId, requestedAdAccountId)
  if (!scope) {
    throw Object.assign(new Error("Connect and select an ad account first."), { code: "NO_SELECTED_AD_ACCOUNT" })
  }
  return scope
}
