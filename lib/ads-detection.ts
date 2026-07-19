import { prisma } from "@/lib/prisma"
import { persistEncryptedGoogleTokenBinding } from "@/lib/google-token-store"
import { GoogleAdsApiError, GoogleAdsService } from "@/services/integrations/google"
import { MetaAdsService, MetaApiError } from "@/services/integrations/meta"
import { encryptedIntegrationTokens } from "@/lib/integration-tokens"

export type AdAccountInfo = {
  externalId: string
  name: string
  currency: string
  managerCustomerId?: string | null
  isManager?: boolean
  level?: number
  status?: string
}

export type GoogleAdsDiscoveryState = "HAS_ACCOUNTS" | "NO_ACCOUNTS" | "API_ERROR"
export type MetaAdsDiscoveryState = "HAS_ACCOUNTS" | "NO_ACCOUNTS" | "API_ERROR"

export type GoogleAdsDetectionResult = {
  hasAdsAccess: boolean
  accounts: AdAccountInfo[]
  discoveryState: GoogleAdsDiscoveryState
  usedAuthorizationFallback?: boolean
  errorCode?: string
  errorMessage?: string
}

export type MetaAdsDetectionResult = {
  hasAdsAccess: boolean
  accounts: AdAccountInfo[]
  discoveryState: MetaAdsDiscoveryState
  errorCode?: string
  errorMessage?: string
}

export async function detectGoogleAdsAccounts(accessToken: string): Promise<GoogleAdsDetectionResult> {
  if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN) {
    return {
      hasAdsAccess: false,
      accounts: [],
      discoveryState: "API_ERROR",
      errorCode: "GOOGLE_ADS_DEVELOPER_TOKEN_MISSING",
      errorMessage: "Google Ads is authenticated, but account discovery is unavailable until GOOGLE_ADS_DEVELOPER_TOKEN is configured.",
    }
  }

  try {
    const discoveredAccounts = await GoogleAdsService.discoverClientAccounts(accessToken)
    const usedAuthorizationFallback = discoveredAccounts.some(
      (account: any) => account.discoveryFallback === "AUTHORIZATION"
    )
    return {
      hasAdsAccess: discoveredAccounts.length > 0,
      accounts: discoveredAccounts as AdAccountInfo[],
      discoveryState: discoveredAccounts.length > 0 ? "HAS_ACCOUNTS" : "NO_ACCOUNTS",
      usedAuthorizationFallback,
    }
  } catch (error) {
    if (error instanceof GoogleAdsApiError) {
      console.warn("[Google Ads Detection] Discovery warning:", error)
      return {
        hasAdsAccess: false,
        accounts: [] as AdAccountInfo[],
        discoveryState: "API_ERROR" as GoogleAdsDiscoveryState,
        errorCode: error.errorCode || "GOOGLE_ADS_API_ERROR",
        errorMessage: error.message,
      }
    }

    console.error("[Google Ads Detection] Unexpected error:", error)
    return {
      hasAdsAccess: false,
      accounts: [] as AdAccountInfo[],
      discoveryState: "API_ERROR" as GoogleAdsDiscoveryState,
      errorCode: "GOOGLE_ADS_DISCOVERY_FAILED",
      errorMessage: error instanceof Error ? error.message : "Google Ads account discovery failed",
    }
  }
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<{
  accessToken: string
  expiresAt: Date
}> {
  const refreshed = await GoogleAdsService.refreshAccessToken(refreshToken)
  const accessToken = refreshed.access_token as string
  const expiresIn = Number(refreshed.expires_in || 3600)
  if (!accessToken) {
    throw new Error("Google access token refresh returned no access token")
  }
  return {
    accessToken,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
  }
}

export async function detectMetaAdsAccounts(accessToken: string): Promise<MetaAdsDetectionResult> {
  try {
    const accounts = await MetaAdsService.discoverAdAccounts(accessToken)
    return {
      hasAdsAccess: accounts.length > 0,
      accounts: accounts.map((account) => ({
        externalId: account.externalId,
        name: account.name,
        currency: account.currency,
        managerCustomerId: null,
        isManager: false,
        status: account.status,
      })),
      discoveryState: accounts.length > 0 ? "HAS_ACCOUNTS" : "NO_ACCOUNTS",
    }
  } catch (err) {
    if (err instanceof MetaApiError) {
      console.warn("[Meta Ads Detection] API warning:", err)
      return {
        hasAdsAccess: false,
        accounts: [] as AdAccountInfo[],
        discoveryState: "API_ERROR",
        errorCode: "META_ADS_API_ERROR",
        errorMessage: err.message,
      }
    }
    console.error("[Meta Ads Detection] Unexpected error:", err)
    return {
      hasAdsAccess: false,
      accounts: [] as AdAccountInfo[],
      discoveryState: "API_ERROR",
      errorCode: "META_ADS_DISCOVERY_FAILED",
      errorMessage: err instanceof Error ? err.message : "Meta Ads account discovery failed",
    }
  }
}

export async function persistIntegration({
  userId,
  workspaceId,
  platform,
  accessToken,
  refreshToken,
  expiresAt,
  hasAdsAccess,
  accounts,
  discoveryState,
  discoveryError,
}: {
  userId: string
  workspaceId?: string | null
  platform: "GOOGLE" | "META"
  accessToken: string
  refreshToken?: string | null
  expiresAt?: Date | null
  hasAdsAccess: boolean
  accounts: AdAccountInfo[]
  discoveryState?: GoogleAdsDiscoveryState | MetaAdsDiscoveryState
  discoveryError?: string | null
}) {
  const scopedWorkspaceId =
    workspaceId ||
    (
      await prisma.workspaceMember.findFirst({
        where: { userId },
        select: { workspaceId: true },
        orderBy: { workspace: { createdAt: "asc" } },
      })
    )?.workspaceId
  if (!scopedWorkspaceId) {
    throw new Error("A workspace is required before connecting an ad platform.")
  }
  const tokenData = encryptedIntegrationTokens(accessToken, refreshToken)

  const existingIntegration = await prisma.integration.findFirst({
    where: { userId, workspaceId: scopedWorkspaceId, platform },
  })

  if (platform === "GOOGLE" && discoveryState === "API_ERROR") {
    if (existingIntegration) {
      const updatedIntegration = await prisma.integration.update({
        where: { id: existingIntegration.id },
        data: {
          workspaceId: scopedWorkspaceId,
          ...tokenData,
          expiresAt,
          status: "RECONNECT_REQUIRED",
          validationError: discoveryError || "Google Ads account discovery failed",
          lastSyncError: discoveryError || existingIntegration.lastSyncError,
          updatedAt: new Date(),
        },
      })

      if (refreshToken) {
        await persistEncryptedGoogleTokenBinding({
          integrationId: updatedIntegration.id,
          refreshToken,
          customerId: existingIntegration.selectedAdAccountId || null,
        })
      }

      return updatedIntegration
    }

    const createdIntegration = await prisma.integration.create({
      data: {
        userId,
        workspaceId: scopedWorkspaceId,
        platform,
        ...tokenData,
        expiresAt,
        hasAdsAccount: false,
        status: "RECONNECT_REQUIRED",
        validationError: discoveryError || "Google Ads account discovery failed",
        lastSyncError: discoveryError || null,
      },
    })

    await persistEncryptedGoogleTokenBinding({
      integrationId: createdIntegration.id,
      refreshToken,
      customerId: null,
    })

    return createdIntegration
  }

  if (platform === "META" && discoveryState === "API_ERROR") {
    if (existingIntegration) {
      const updatedIntegration = await prisma.integration.update({
        where: { id: existingIntegration.id },
        data: {
          ...tokenData,
          expiresAt,
          status: "RECONNECT_REQUIRED",
          validationError: discoveryError || "Meta Ads account discovery failed",
          lastSyncError: discoveryError || existingIntegration.lastSyncError,
          updatedAt: new Date(),
        },
      })
      return updatedIntegration
    }

    const createdIntegration = await prisma.integration.create({
      data: {
        userId,
        workspaceId: scopedWorkspaceId,
        platform,
        ...tokenData,
        expiresAt,
        hasAdsAccount: false,
        hasAdsAccess: false,
        status: "RECONNECT_REQUIRED",
        validationError: discoveryError || "Meta Ads account discovery failed",
        lastSyncError: discoveryError || null,
      },
    })
    return createdIntegration
  }

  const integration = existingIntegration
    ? await prisma.integration.update({
      where: { id: existingIntegration.id },
      data: {
        workspaceId: scopedWorkspaceId,
        ...tokenData,
        expiresAt,
        hasAdsAccount: hasAdsAccess,
        hasAdsAccess,
        status: hasAdsAccess ? "ACCOUNT_SELECTED" : "NO_AD_ACCOUNT",
        validationError: null,
        updatedAt: new Date(),
      },
    })
    : await prisma.integration.create({
      data: {
      userId,
      workspaceId: scopedWorkspaceId,
      platform,
      ...tokenData,
      expiresAt,
      hasAdsAccount: hasAdsAccess,
      hasAdsAccess,
      status: hasAdsAccess ? "ACCOUNT_SELECTED" : "NO_AD_ACCOUNT",
      validationError: null,
      },
    })

  if (!hasAdsAccess || accounts.length === 0) {
    await prisma.adAccount.deleteMany({ where: { integrationId: integration.id } })
    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        selectedAdAccountId: null,
        selectedAdAccountName: null,
      },
    })
    if (platform === "GOOGLE") {
      await persistEncryptedGoogleTokenBinding({
        integrationId: integration.id,
        refreshToken,
        customerId: null,
      })
    }
    return integration
  }

  const incomingIds = accounts.map((account) => account.externalId)
  await prisma.adAccount.deleteMany({
    where: {
      integrationId: integration.id,
      externalId: { notIn: incomingIds },
    },
  })

  for (const account of accounts) {
    await prisma.adAccount.upsert({
      where: {
        integrationId_externalId: {
          integrationId: integration.id,
          externalId: account.externalId,
        },
      },
      create: {
        integrationId: integration.id,
        userId,
        workspaceId: scopedWorkspaceId,
        platform,
        externalId: account.externalId,
        name: account.name,
        currencyCode: account.currency,
        managerCustomerId: account.managerCustomerId || null,
        isManager: account.isManager ?? false,
        isPrimary: false,
      },
      update: {
        userId,
        workspaceId: scopedWorkspaceId,
        name: account.name,
        currencyCode: account.currency,
        managerCustomerId: account.managerCustomerId || null,
        isManager: account.isManager ?? false,
      },
    })
  }

  let selectedAccount = await prisma.adAccount.findFirst({
    where: { integrationId: integration.id, isPrimary: true },
  })

  if (!selectedAccount) {
    selectedAccount = await prisma.adAccount.findFirst({
      where: { integrationId: integration.id },
      orderBy: { createdAt: "asc" },
    })
    if (selectedAccount) {
      await prisma.adAccount.update({
        where: { id: selectedAccount.id },
        data: { isPrimary: true },
      })
    }
  }

  if (selectedAccount) {
    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        selectedAdAccountId: selectedAccount.externalId,
        selectedAdAccountName: selectedAccount.name,
      },
    })
  }

  if (platform === "GOOGLE") {
    await persistEncryptedGoogleTokenBinding({
      integrationId: integration.id,
      refreshToken,
      customerId: selectedAccount?.externalId || null,
    })
  }

  return integration
}
