import NextAuth from "next-auth"
import { NextResponse } from "next/server"
import { authConfig } from "./auth.config"
import { isAllowedBrowserMutation } from "./lib/request-origin"

const { auth } = NextAuth(authConfig)
const publicRoutes = ["/", "/privacy", "/terms", "/compliance"]

export default auth((req) => {
  const isLoggedIn = Boolean(req.auth)
  const isDemoMode =
    process.env.NODE_ENV !== "production" &&
    process.env.ENABLE_DEMO_MODE === "true" &&
    req.cookies.get("growzzy_demo_mode")?.value === "true"
  const { pathname } = req.nextUrl
  const isPublicRoute = publicRoutes.some((route) => pathname === route)
  const isDashboardPage = pathname.startsWith("/dashboard")

  const forwardedProto = req.headers.get("x-forwarded-proto")
  const forwardedHost = req.headers.get("x-forwarded-host")
  const requestOrigin = forwardedProto && forwardedHost ? `${forwardedProto}://${forwardedHost}` : req.nextUrl.origin
  if (!isAllowedBrowserMutation({
    method: req.method,
    pathname,
    requestOrigin,
    originHeader: req.headers.get("origin"),
    fetchSite: req.headers.get("sec-fetch-site"),
  })) {
    return NextResponse.json({ ok: false, error: { code: "CROSS_ORIGIN_MUTATION", message: "Cross-origin mutation blocked." } }, { status: 403 })
  }

  if (isPublicRoute) {
    return NextResponse.next()
  }

  if (isDashboardPage && !isLoggedIn && !isDemoMode) {
    const loginUrl = new URL("/auth", req.nextUrl)
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search)
    return NextResponse.redirect(loginUrl)
  }

  // If in demo mode, explicitly allow
  if (isDemoMode) {
    return NextResponse.next()
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
