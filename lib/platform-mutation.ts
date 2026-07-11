import type { AdAccount, Campaign, Integration } from "@prisma/client"
import { isUnverifiedExternalId } from "@/lib/data-trust"
import { updateGoogleCampaignStatus } from "@/lib/platform-actions"
import { GoogleAdsService } from "@/services/integrations/google"

type CampaignWithIntegration = Campaign & {
  integration: (Integration & { adAccounts?: AdAccount[] | null }) | null
}

type MutationKind = "STATUS" | "REMOVE" | "BUDGET"

function hoursSince(date?: Date | null) {
  if (!date) return Number.POSITIVE_INFINITY
  return (Date.now() - date.getTime()) / (1000 * 60 * 60)
}

function normalizeGoogleStatus(status: "ACTIVE" | "PAUSED" | "REMOVED" | "ENABLED") {
  if (status === "ACTIVE") return "ENABLED" as const
  if (status === "REMOVED") return "REMOVED" as const
  if (status === "ENABLED") return "ENABLED" as const
  return "PAUSED" as const
}

function preflightError(message: string, remediation: string) {
  return new Error(`${message} Remediation: ${remediation}`)
}

export function assertCampaignMutationSafe(campaign: CampaignWithIntegration, kind: MutationKind) {
  if (!campaign.isLive || isUnverifiedExternalId(campaign.externalId)) {
    throw preflightError(
      "Draft or unverified campaign. Platform mutation blocked.",
      "Sync campaigns and only run actions on verified live campaigns."
    )
  }
  if (!campaign.integration?.accessToken) {
    throw preflightError(
      "Platform token missing. Reconnect the ad account first.",
      "Reconnect integration in Ad Accounts and rerun sync."
    )
  }
  if (!campaign.integration?.hasAdsAccess || campaign.integration?.status !== "ACTIVE") {
    throw preflightError(
      "Integration is not active with ads access. Reconnect and sync first.",
      "Complete OAuth, choose the right ad account, then click Sync."
    )
  }
  const latestSync = campaign.integration.lastSyncedAt || campaign.integration.lastSyncAt
  if (hoursSince(latestSync) > 24) {
    throw preflightError(
      "Data is stale (>24h since last sync). Run sync before applying mutations.",
      "Run a fresh sync to validate ownership and latest status."
    )
  }

  if (campaign.platform !== "GOOGLE") {
    throw preflightError(
      "Only Google campaign mutations are supported in this pass.",
      "Use a synced Google Ads campaign."
    )
  }
}

export async function mutateCampaignStatusOnPlatform(
  campaign: CampaignWithIntegration,
  status: "ACTIVE" | "PAUSED" | "REMOVED" | "ENABLED"
) {
  assertCampaignMutationSafe(campaign, status === "REMOVED" ? "REMOVE" : "STATUS")
  const integration = campaign.integration
  if (!integration) {
    throw new Error("Campaign integration missing. Reconnect and sync first.")
  }

  if (campaign.platform === "GOOGLE") {
    const customerId = campaign.adAccountId || integration.selectedAdAccountId || integration.accountId
    if (!customerId) throw new Error("Google customer ID missing for this campaign.")
    const adAccounts = integration.adAccounts || []
    const primary = adAccounts.find((account) => account.isPrimary)
    const loginCustomerId = primary?.managerCustomerId || integration.selectedAdAccountId || integration.accountId
    return updateGoogleCampaignStatus({
      accessToken: integration.accessToken || "",
      customerId,
      campaignId: campaign.externalId,
      status: normalizeGoogleStatus(status),
      loginCustomerId,
    })
  }

  throw new Error("Unsupported platform for status mutation.")
}

export async function mutateGoogleCampaignBudgetOnPlatform(
  campaign: CampaignWithIntegration,
  nextBudgetAmount: number
) {
  assertCampaignMutationSafe(campaign, "BUDGET")
  const integration = campaign.integration
  if (!integration) {
    throw new Error("Campaign integration missing. Reconnect and sync first.")
  }
  if (campaign.platform !== "GOOGLE") {
    throw new Error("Budget mutation is only supported for Google right now.")
  }
  if (!Number.isFinite(nextBudgetAmount) || nextBudgetAmount <= 0) {
    throw new Error("Budget amount must be a positive number.")
  }

  const customerId = campaign.adAccountId || integration.selectedAdAccountId || integration.accountId
  if (!customerId) throw new Error("Google customer ID missing for this campaign.")
  const adAccounts = integration.adAccounts || []
  const primary = adAccounts.find((account) => account.isPrimary)
  const loginCustomerId = primary?.managerCustomerId || integration.selectedAdAccountId || integration.accountId

  const raw = (campaign.rawData || {}) as Record<string, unknown>
  const budgetResourceName =
    campaign.externalBudgetId ||
    (raw?.campaignBudget as { resourceName?: string; id?: string } | undefined)?.resourceName ||
    (raw?.campaignBudget as { resourceName?: string; id?: string } | undefined)?.id
  if (!budgetResourceName) throw new Error("Google campaign budget resource is missing.")

  return GoogleAdsService.updateCampaignBudget({
    accessToken: integration.accessToken || "",
    customerId,
    campaignBudgetResourceName: String(budgetResourceName),
    amountMicros: Math.round(nextBudgetAmount * 1_000_000),
    loginCustomerId,
  })
}
