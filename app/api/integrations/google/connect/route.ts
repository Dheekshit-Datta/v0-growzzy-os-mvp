import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { GoogleAdsService } from '@/services/integrations/google'
import { attachStateCookie, generateState } from '@/lib/oauth-state'
import { log } from '@/lib/logger'

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const requestUrl = new URL(request.url)
    const redirectUri = `${requestUrl.origin}/api/auth/google/callback`
    log("info", "google/oauth/connect", "Creating OAuth request", {
      clientId: GoogleAdsService.getOAuthClientId(),
      redirectUri,
    })
    const state = generateState()
    const authUrl = GoogleAdsService.getAuthUrl({ redirectUri, state })
    const response = attachStateCookie(NextResponse.redirect(authUrl), "google", state)

    // Remember where to send the user back to (e.g. mid-onboarding vs Settings)
    // so the callback doesn't dump them on a page the onboarding gate will
    // immediately bounce them away from, losing the "connected" state.
    const returnTo = requestUrl.searchParams.get("returnTo")
    if (returnTo && returnTo.startsWith("/")) {
      response.cookies.set("oauth_return_to", returnTo, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 600,
        path: "/",
      })
    }

    return response
  } catch (error: any) {
    log("error", "google/oauth/connect", "Failed to create OAuth request", { message: error?.message })
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
