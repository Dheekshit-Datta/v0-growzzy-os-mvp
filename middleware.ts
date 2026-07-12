import NextAuth from 'next-auth'
import { authConfig } from './auth.config'
import { NextResponse } from "next/server"

const { auth } = NextAuth(authConfig)
const publicRoutes = ["/", "/privacy", "/terms", "/compliance"]

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isDemoMode =
    process.env.NODE_ENV !== "production" &&
    process.env.ENABLE_DEMO_MODE === "true" &&
    req.cookies.get("growzzy_demo_mode")?.value === "true"
  const { pathname } = req.nextUrl
  const isPublicRoute = publicRoutes.some((route) => pathname === route)
  const isDashboardPage = pathname.startsWith("/dashboard")

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
