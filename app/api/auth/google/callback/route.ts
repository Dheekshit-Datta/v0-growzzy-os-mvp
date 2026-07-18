export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { resolveUserId } from "@/lib/resolve-user"
import { detectGoogleAdsAccounts, persistIntegration } from "@/lib/ads-detection"
import { syncGoogleAdsCampaigns } from "@/lib/sync-engine"
import { prisma } from "@/lib/prisma"
import { GoogleAdsService } from "@/services/integrations/google"
import { getPrimaryWorkspaceId, getRequestWorkspaceId } from "@/lib/workspace"
import { getStateCookieName, verifyState } from "@/lib/oauth-state"
import { log } from "@/lib/logger"

function resolveAppUrlFromRequest(request: Request) {
  const requestUrl = new URL(request.url)
  const forwardedProto = request.headers.get("x-forwarded-proto")
  const forwardedHost = request.headers.get("x-forwarded-host")
  return forwardedProto && forwardedHost ? `${forwardedProto}://${forwardedHost}` : requestUrl.origin
}

function redirectWithClearedState(url: string) {
  const response = NextResponse.redirect(url)
  response.cookies.delete(getStateCookieName("google"))
  response.cookies.delete("oauth_return_to")
  return response
}

function resolveReturnTo(request: Request, appUrl: string, params: string) {
  const cookieHeader = request.headers.get("cookie") || ""
  const match = cookieHeader.split(";").map((c) => c.trim()).find((c) => c.startsWith("oauth_return_to="))
  const returnTo = match ? decodeURIComponent(match.slice("oauth_return_to=".length)) : null
  if (returnTo && returnTo.startsWith("/")) {
    const separator = returnTo.includes("?") ? "&" : "?"
    return `${appUrl}${returnTo}${separator}${params}`
  }
  return `${appUrl}/dashboard/settings?tab=integrations&${params}`
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")
  const appUrl = resolveAppUrlFromRequest(request)

  if (!(await verifyState("google", state))) {
    return redirectWithClearedState(resolveReturnTo(request, appUrl, "error=google_invalid_state"))
  }

  if (error) {
    log("warn", "google/oauth/callback", "OAuth provider returned an error", { error })
    return redirectWithClearedState(resolveReturnTo(request, appUrl, "error=google_auth_failed"))
  }

  if (!code) {
    return redirectWithClearedState(resolveReturnTo(request, appUrl, "error=google_missing_code"))
  }

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return redirectWithClearedState(resolveReturnTo(request, appUrl, "error=unauthorized"))
    }

    const userId = await resolveUserId(session.user.id)
    let workspaceId: string

    try {
      workspaceId = await getRequestWorkspaceId(userId, request as any)
    } catch (workspaceError: any) {
      log("warn", "google/oauth/callback", "Workspace resolution failed; falling back to primary workspace", {
        message: workspaceError?.message,
      })
      workspaceId = await getPrimaryWorkspaceId(userId)
    }

    const redirectUri = `${new URL(request.url).origin}/api/auth/google/callback`
    log("info", "google/oauth/callback", "Exchanging OAuth code", {
      clientId: GoogleAdsService.getOAuthClientId(),
      redirectUri,
    })

    const tokens = await GoogleAdsService.exchangeCode(code, { redirectUri })
    const { access_token, refresh_token, expires_in } = tokens

    if (!access_token) {
      throw new Error("No access token received")
    }

    const expiresAt = new Date(Date.now() + (expires_in ?? 3600) * 1000)
    const detection = await detectGoogleAdsAccounts(access_token)
    if (detection.usedAuthorizationFallback) {
      console.warn("[Google OAuth Callback] Using authorization fallback root account discovery")
    }

    await persistIntegration({
      userId,
      workspaceId,
      platform: "GOOGLE",
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt,
      hasAdsAccess: detection.hasAdsAccess,
      accounts: detection.accounts,
      discoveryState: detection.discoveryState,
      discoveryError: detection.errorMessage || null,
    })

    if (detection.discoveryState === "API_ERROR") {
      return redirectWithClearedState(
        resolveReturnTo(request, appUrl, "connected=google&status=reconnect_required&error=google_discovery_failed")
      )
    }

    if (detection.hasAdsAccess) {
      // A real connected ad account is itself sufficient evidence the user
      // is past onboarding, regardless of whether they go on to click the
      // "finish" button on the onboarding page - don't leave them stuck
      // re-seeing onboarding on every future login if they don't.
      await prisma.user.updateMany({
        where: { id: userId, onboardingCompleted: false },
        data: { onboardingCompleted: true, onboardingStep: 3 },
      })

      const primaryAccount = await prisma.adAccount.findFirst({
        where: { userId, workspaceId, platform: "GOOGLE", isPrimary: true },
        include: { integration: true },
      })

      if (primaryAccount) {
        if (detection.usedAuthorizationFallback) {
          console.warn("[Google OAuth Callback] Auto-sync skipped due to authorization fallback", {
            userId,
            accountId: primaryAccount.externalId,
          })
        } else {
          syncGoogleAdsCampaigns(
            userId,
            primaryAccount.integration.id,
            primaryAccount.id,
            primaryAccount.externalId,
            access_token,
            primaryAccount.managerCustomerId
          ).catch((syncError) => log("error", "google/oauth/callback", "Auto-sync failed", { message: syncError?.message }))
        }
      }

      return redirectWithClearedState(resolveReturnTo(request, appUrl, "connected=google&status=success"))
    }

    return redirectWithClearedState(resolveReturnTo(request, appUrl, "connected=google&status=no_ads_account"))
  } catch (err: any) {
    log("error", "google/oauth/callback", "Callback failed", { message: err?.message })
    return redirectWithClearedState(resolveReturnTo(request, appUrl, "error=server_error"))
  }
}
