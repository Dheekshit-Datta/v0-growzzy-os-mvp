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
    return attachStateCookie(NextResponse.redirect(authUrl), "google", state)
  } catch (error: any) {
    log("error", "google/oauth/connect", "Failed to create OAuth request", { message: error?.message })
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
