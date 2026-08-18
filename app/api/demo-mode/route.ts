import { encode } from "next-auth/jwt"
import { NextRequest, NextResponse } from "next/server"

const isPreviewOnly = process.env.NODE_ENV !== "production"

export async function GET(request: NextRequest) {
  if (!isPreviewOnly) {
    return NextResponse.json({ ok: false, error: "Demo mode is disabled in production." }, { status: 404 })
  }

  const callbackUrl = request.nextUrl.searchParams.get("callbackUrl") || "/dashboard/campaigns/new"
  const safeCallbackUrl = callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/dashboard/campaigns/new"
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "development-only-secret-do-not-deploy"
  const token = await encode({
    secret,
    token: {
      sub: "demo-user",
      id: "demo-user",
      name: "Demo User",
      email: "demo.user@example.com",
    },
    salt: "authjs.session-token",
  })

  const response = NextResponse.redirect(new URL(safeCallbackUrl, request.url))
  response.cookies.set("authjs.session-token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 60 * 60 * 8,
  })
  response.cookies.set("growzzy_demo_mode", "true", {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 60 * 60 * 8,
  })
  return response
}
