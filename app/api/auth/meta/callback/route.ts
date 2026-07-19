export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { detectMetaAdsAccounts, persistIntegration } from "@/lib/ads-detection"
import { log } from "@/lib/logger"
import { getStateCookieName, verifyState } from "@/lib/oauth-state"
import { resolveUserId } from "@/lib/resolve-user"
import { getPrimaryWorkspaceId, getRequestWorkspaceId } from "@/lib/workspace"
import { MetaAdsService } from "@/services/integrations/meta"

function appUrl(request: Request) {
  const url = new URL(request.url)
  const proto = request.headers.get("x-forwarded-proto")
  const host = request.headers.get("x-forwarded-host")
  return proto && host ? `${proto}://${host}` : url.origin
}

function returnUrl(request: Request, baseUrl: string, params: string) {
  const cookie = (request.headers.get("cookie") || "")
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith("oauth_return_to="))
  const returnTo = cookie ? decodeURIComponent(cookie.slice("oauth_return_to=".length)) : null
  if (returnTo?.startsWith("/")) return `${baseUrl}${returnTo}${returnTo.includes("?") ? "&" : "?"}${params}`
  return `${baseUrl}/dashboard/settings?tab=integrations&${params}`
}

function redirectAndClear(request: Request, baseUrl: string, params: string) {
  const response = NextResponse.redirect(returnUrl(request, baseUrl, params))
  response.cookies.delete(getStateCookieName("meta"))
  response.cookies.delete("oauth_return_to")
  return response
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const baseUrl = appUrl(request)
  if (!MetaAdsService.isEnabled()) return redirectAndClear(request, baseUrl, "error=meta_disabled")
  if (!(await verifyState("meta", url.searchParams.get("state")))) {
    return redirectAndClear(request, baseUrl, "error=meta_invalid_state")
  }
  if (url.searchParams.get("error")) return redirectAndClear(request, baseUrl, "error=meta_auth_failed")
  const code = url.searchParams.get("code")
  if (!code) return redirectAndClear(request, baseUrl, "error=meta_missing_code")

  try {
    const session = await auth()
    if (!session?.user?.id) return redirectAndClear(request, baseUrl, "error=unauthorized")
    const userId = await resolveUserId(session.user.id)
    let workspaceId: string
    try {
      workspaceId = await getRequestWorkspaceId(userId, request as any)
    } catch {
      workspaceId = await getPrimaryWorkspaceId(userId)
    }

    const redirectUri = `${url.origin}/api/auth/meta/callback`
    const shortToken = await MetaAdsService.exchangeCode(code, { redirectUri })
    const longToken = await MetaAdsService.exchangeLongLivedToken(String(shortToken.access_token))
    const accessToken = String(longToken.access_token || shortToken.access_token || "")
    if (!accessToken) throw new Error("Meta returned no access token")
    const expiresIn = Number(longToken.expires_in || shortToken.expires_in || 0)
    const expiresAt = expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000) : null
    const detection = await detectMetaAdsAccounts(accessToken)

    await persistIntegration({
      userId,
      workspaceId,
      platform: "META",
      accessToken,
      expiresAt,
      hasAdsAccess: detection.hasAdsAccess,
      accounts: detection.accounts,
      discoveryState: detection.discoveryState,
      discoveryError: detection.errorMessage || null,
    })

    if (detection.discoveryState === "API_ERROR") {
      return redirectAndClear(request, baseUrl, "connected=meta&status=reconnect_required&error=meta_discovery_failed")
    }
    return redirectAndClear(
      request,
      baseUrl,
      detection.hasAdsAccess ? "connected=meta&status=account_selection_required" : "connected=meta&status=no_ads_account"
    )
  } catch (error: any) {
    log("error", "meta/oauth/callback", "Callback failed", { message: error?.message })
    return redirectAndClear(request, baseUrl, "error=server_error")
  }
}
