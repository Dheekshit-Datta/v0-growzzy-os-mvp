import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { syncGoogleAdsCampaigns } from "@/lib/sync-engine"
import { GoogleAdsApiError } from "@/services/integrations/google"
import { log } from "@/lib/logger"
import { rateLimitPolicy } from "@/lib/rate-limit"
import { getRequestWorkspaceId } from "@/lib/workspace"
import { logSlowApi } from "@/lib/api-timing"
import { getIntegrationAccessToken } from "@/lib/integration-tokens"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const startedAtMs = Date.now()
  const correlationId = `sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, code: "UNAUTHORIZED", correlationId, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { platform } = await req.json()
    if (!platform) return NextResponse.json({ success: false, code: "PLATFORM_REQUIRED", correlationId, error: "Platform required" }, { status: 400 })

    const userId = await resolveUserId(session.user.id)
    const workspaceId = await getRequestWorkspaceId(userId, req as any)
    const limit = await rateLimitPolicy(userId, "platformSync")
    if (!limit.allowed) {
      return NextResponse.json(
        {
          success: false,
          code: limit.unavailable ? "RATE_LIMIT_UNAVAILABLE" : "RATE_LIMITED",
          correlationId,
          error: limit.unavailable ? "Sync protection is temporarily unavailable. Please try again shortly." : "Too many sync requests. Try again shortly.",
          providerMessage: limit.unavailable ? "Rate-limit backend unavailable; local guard active." : "Manual sync rate limit exceeded.",
          remediation: limit.unavailable ? ["Retry in a few seconds.", "If issue persists, verify Redis configuration."] : ["Wait for the retry window and run sync again."],
        },
        { status: limit.unavailable ? 503 : 429, headers: { "Retry-After": String(limit.retryAfter) } }
      )
    }

    const platformKey = platform.toUpperCase()
    if (platformKey !== "GOOGLE") {
      return NextResponse.json({
        success: false,
        code: "PLATFORM_UNSUPPORTED",
        correlationId,
        error: "Only Google Ads sync is supported in this pass.",
        remediation: ["Reconnect a Google Ads account."],
      }, { status: 400 })
    }

    const integration = await prisma.integration.findFirst({
      where: {
        userId,
        workspaceId,
        platform: "GOOGLE",
      },
      include: {
        adAccounts: { where: { isPrimary: true } },
      },
    })

    if (!integration) {
      return NextResponse.json({
        success: false,
        code: "CONNECTION_NOT_FOUND",
        correlationId,
        error: "Connection not found",
        remediation: ["Reconnect the platform from Settings > Integrations.", "Confirm you're in the correct workspace."],
      }, { status: 404 })
    }

    // Guard: reject sync only when there is no resolvable ads account mapping
    const hasResolvableAdAccount = Boolean(
      integration.hasAdsAccount ||
        integration.selectedAdAccountId ||
        integration.accountId ||
        integration.adAccounts.length > 0
    )
    if (!hasResolvableAdAccount) {
      return NextResponse.json(
        {
          success: false,
          code: "NO_ADS_ACCOUNT",
          correlationId,
          error: "No valid ads account connected. Please reconnect with an account that has ad access.",
          remediation: ["Open Settings > Integrations.", "Reconnect and select a valid ads account.", "Run sync again."],
        },
        { status: 400 }
      )
    }

    // Mark as syncing
    await prisma.integration.update({
      where: { id: integration.id },
      data: { lastSyncStatus: "SYNCING" },
    })

    let primaryAccount = integration.adAccounts[0]
    if (!primaryAccount) {
      const fallbackExternalId = integration.selectedAdAccountId || integration.accountId
      if (fallbackExternalId) {
        const existing = await prisma.adAccount.findFirst({
          where: { integrationId: integration.id, externalId: fallbackExternalId },
        })
        primaryAccount =
          existing ||
          (await prisma.adAccount.create({
            data: {
              integrationId: integration.id,
              workspaceId,
              userId,
              platform: integration.platform,
              externalId: fallbackExternalId,
              name: integration.accountName || fallbackExternalId,
              isPrimary: true,
            },
          }))
        if (!integration.selectedAdAccountId) {
          await prisma.integration.update({
            where: { id: integration.id },
            data: {
              selectedAdAccountId: fallbackExternalId,
              selectedAdAccountName: integration.accountName || fallbackExternalId,
              hasAdsAccount: true,
            },
          })
        }
      }
    }

    const accessToken = getIntegrationAccessToken(integration)
    if (primaryAccount && accessToken) {
      try {
        let count = 0
        if (integration.platform === "GOOGLE") {
          try {
            count = await syncGoogleAdsCampaigns(
              userId,
              integration.id,
              primaryAccount.id,
              primaryAccount.externalId,
              accessToken,
              primaryAccount.managerCustomerId
            )
          } catch (syncErr: any) {
            if (syncErr instanceof GoogleAdsApiError && syncErr.status === 403) {
              const accessDeniedMessage =
                "Access Denied: Ensure you are using a Production Developer Token for real accounts, or use a Test Account for development."
              await prisma.adAccount.update({
                where: { id: primaryAccount.id },
                data: { syncStatus: "ACCESS_DENIED", syncError: accessDeniedMessage },
              })
              await prisma.integration.update({
                where: { id: integration.id },
                data: {
                  status: "ACTIVE",
                  lastSyncStatus: "ACCESS_DENIED",
                  lastSyncError: accessDeniedMessage,
                },
              })
              return NextResponse.json(
                {
                  ok: false,
                  success: false,
                  code: "ACCESS_DENIED",
                  correlationId,
                  status: "ACCESS_DENIED",
                  message: accessDeniedMessage,
                  providerMessage: accessDeniedMessage,
                  remediation: ["Use a production Google Ads developer token for live accounts.", "Or connect a test account for development."],
                },
                { status: 200 }
              )
            }
            throw syncErr
          }
        }
        await prisma.notification.create({
          data: {
            userId,
            workspaceId,
            title: "Sync complete",
            body: `${integration.platform} sync updated ${count} campaign${count === 1 ? "" : "s"}.`,
            type: "SYNC_COMPLETE",
          },
        })
        return NextResponse.json({
          success: true,
          ok: true,
          code: "SYNC_SUCCESS",
          correlationId,
          campaignCount: count,
          syncedCampaigns: count,
          importedCampaignCount: count,
          selectedAccount: {
            id: primaryAccount.id,
            externalId: primaryAccount.externalId,
            name: primaryAccount.name,
          },
          providerMessage: `${integration.platform} sync completed successfully.`,
          remediation: [],
          status: "ACTIVE",
        })
      } catch (syncErr: any) {
        await prisma.integration.update({
          where: { id: integration.id },
          data: { lastSyncStatus: "FAILED", lastSyncError: syncErr.message },
        })
        log("error", "api/integrations/sync", "Manual sync failed", {
          userId,
          platform: String(integration.platform),
          message: syncErr?.message,
        })
        return NextResponse.json(
          {
            success: false,
            code: "SYNC_FAILED",
            correlationId,
            error: syncErr.message,
            providerMessage: syncErr.message,
            remediation: [
              "Open Settings > Integrations and verify account access.",
              "Reconnect the provider if token/scopes are expired.",
              "Retry sync after resolving the provider error.",
            ],
          },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(
      {
        success: false,
        code: "NO_SELECTED_AD_ACCOUNT",
        correlationId,
        error: "Select a verified ad account before syncing. Legacy unscoped sync is disabled to prevent cross-account data leakage.",
        remediation: [
          "Open Settings > Integrations.",
          "Select a verified ad account for this workspace.",
          "Run sync again.",
        ],
      },
      { status: 409 }
    )
  } catch (err: any) {
    log("error", "api/integrations/sync", "Manual sync route failed", { message: err?.message, stack: err?.stack })
    return NextResponse.json(
      {
        success: false,
        code: "SYNC_ROUTE_FAILED",
        correlationId,
        error: err.message,
        providerMessage: err.message,
        remediation: ["Retry sync.", "If it fails repeatedly, reconnect integration and verify provider credentials."],
      },
      { status: 500 }
    )
  } finally {
    logSlowApi("/api/integrations/sync", startedAtMs)
  }
}
