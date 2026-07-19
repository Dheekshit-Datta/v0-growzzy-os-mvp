import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { attachStateCookie, generateState } from "@/lib/oauth-state"
import { log } from "@/lib/logger"
import { MetaAdsService } from "@/services/integrations/meta"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 })
  }
  if (!MetaAdsService.isEnabled()) {
    return NextResponse.json({ ok: false, error: { code: "META_DISABLED", message: "Meta Ads is not enabled yet." } }, { status: 404 })
  }

  try {
    const requestUrl = new URL(request.url)
    const redirectUri = `${requestUrl.origin}/api/auth/meta/callback`
    const state = generateState()
    const response = attachStateCookie(
      NextResponse.redirect(MetaAdsService.getAuthUrl({ redirectUri, state })),
      "meta",
      state
    )
    const returnTo = requestUrl.searchParams.get("returnTo")
    if (returnTo?.startsWith("/")) {
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
    log("error", "meta/oauth/connect", "Failed to create OAuth request", { message: error?.message })
    return NextResponse.json(
      { ok: false, error: { code: "META_CONFIGURATION_ERROR", message: "Meta Ads connection is not configured." } },
      { status: 503 }
    )
  }
}
