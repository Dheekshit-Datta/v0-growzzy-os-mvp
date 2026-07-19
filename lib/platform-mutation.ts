import type { AdAccount, Campaign, Integration } from "@prisma/client"
import { isUnverifiedExternalId } from "@/lib/data-trust"
import { updateGoogleCampaignStatus } from "@/lib/platform-actions"
import { GoogleAdsService } from "@/services/integrations/google"
import { getIntegrationAccessToken } from "@/lib/integration-tokens"
import { MetaAdsService } from "@/services/integrations/meta"
import { currencyMinorAmount } from "@/lib/services/meta-publish"

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
  if (!campaign.integration || !getIntegrationAccessToken(campaign.integration)) {
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

  if (campaign.platform !== "GOOGLE" && campaign.platform !== "META") {
    throw preflightError(
      "This campaign platform is not supported for live mutations.",
      "Use a verified Google or Meta campaign."
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
  const accessToken = getIntegrationAccessToken(integration)
  if (!accessToken) throw new Error("Platform access token missing. Reconnect the ad account first.")

  if (campaign.platform === "GOOGLE") {
    const customerId = campaign.adAccountExternalId || integration.selectedAdAccountId || integration.accountId
    if (!customerId) throw new Error("Google customer ID missing for this campaign.")
    const adAccounts = integration.adAccounts || []
    const primary = adAccounts.find((account) => account.isPrimary)
    const loginCustomerId = primary?.managerCustomerId || null
    return updateGoogleCampaignStatus({
      accessToken,
      customerId,
      campaignId: campaign.externalId,
      status: normalizeGoogleStatus(status),
      loginCustomerId,
    })
  }

  if (campaign.platform === "META") {
    const metaStatus = status === "REMOVED" ? "ARCHIVED" : status === "ENABLED" ? "ACTIVE" : status
    return MetaAdsService.updateCampaignStatus(accessToken, campaign.externalId, metaStatus)
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

  const accessToken = getIntegrationAccessToken(integration)
  if (!accessToken) throw new Error("Platform access token missing. Reconnect the ad account first.")
  if (!Number.isFinite(nextBudgetAmount) || nextBudgetAmount <= 0) {
    throw new Error("Budget amount must be a positive number.")
  }

  if (campaign.platform === "META") {
    const raw = (campaign.rawData || {}) as Record<string, any>
    const adSetId = raw?.meta?.adSetId
    if (!adSetId) throw new Error("Meta ad set ID is missing; sync this campaign before changing its budget.")
    const account = (integration.adAccounts || []).find((item) => item.externalId === campaign.adAccountExternalId) || (integration.adAccounts || []).find((item) => item.isPrimary)
    return MetaAdsService.updateAdSetBudget(accessToken, String(adSetId), currencyMinorAmount(nextBudgetAmount, account?.currencyCode || "USD"))
  }
  if (campaign.platform !== "GOOGLE") throw new Error("Unsupported platform for budget mutation.")

  const customerId = campaign.adAccountExternalId || integration.selectedAdAccountId || integration.accountId
  if (!customerId) throw new Error("Google customer ID missing for this campaign.")
  const adAccounts = integration.adAccounts || []
  const primary = adAccounts.find((account) => account.isPrimary)
  const loginCustomerId = primary?.managerCustomerId || null

  const raw = (campaign.rawData || {}) as Record<string, unknown>
  const budgetResourceName =
    campaign.externalBudgetId ||
    (raw?.campaignBudget as { resourceName?: string; id?: string } | undefined)?.resourceName ||
    (raw?.campaignBudget as { resourceName?: string; id?: string } | undefined)?.id
  if (!budgetResourceName) throw new Error("Google campaign budget resource is missing.")

  return GoogleAdsService.updateCampaignBudget({
    accessToken,
    customerId,
    campaignBudgetResourceName: String(budgetResourceName),
    amountMicros: Math.round(nextBudgetAmount * 1_000_000),
    loginCustomerId,
  })
}
