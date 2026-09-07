import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { log } from '@/lib/logger'

/**
 * Meta Ads OAuth connect start endpoint.
 *
 * Real Meta OAuth requires an app id/secret and a long-lived token exchange
 * against graph.facebook.com. The production wiring lives in
 * `services/integrations/meta.ts` (to be built in Part 5 of the
 * GROWZZY_COMPETITIVE_PARITY_SPEC). Until then, this stub returns a
 * clear "not yet wired" response so the chat's connect card degrades
 * gracefully instead of redirecting to a 404.
 *
 * When the service exists, the wire-up is identical to the Google one
 * (see app/api/integrations/google/connect/route.ts).
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  log("info", "meta/oauth/connect", "Connect requested but Meta OAuth is not yet wired in this build")

  return NextResponse.json(
    {
      error: "Meta Ads connection is coming soon. Your campaign is saved as a draft — connect Meta in Settings → Integrations once it's available.",
      code: "META_OAUTH_NOT_WIRED",
    },
    { status: 501 },
  )
}
