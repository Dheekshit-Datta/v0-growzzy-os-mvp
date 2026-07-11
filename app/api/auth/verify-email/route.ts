import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"
    const limit = await rateLimit(`auth:verify-email:${ip}`, 20, 60_000, { strict: true })
    if (!limit.allowed) {
      return NextResponse.json({ error: limit.unavailable ? "Email verification is temporarily unavailable. Please try again shortly." : "Too many verification attempts. Please wait a moment." }, { status: limit.unavailable ? 503 : 429, headers: { "Retry-After": String(limit.retryAfter) } })
    }

    const { token } = await req.json()
    if (!token) return NextResponse.json({ error: "Verification token is required" }, { status: 400 })

    const existing = await prisma.user.findFirst({
      where: {
        emailVerificationToken: String(token),
        emailVerificationExp: { gt: new Date() },
      },
      select: { id: true },
    })

    if (!existing) {
      return NextResponse.json({ error: "Invalid or expired verification link" }, { status: 400 })
    }

    const user = await prisma.user.update({
      where: { id: existing.id },
      data: {
        emailVerified: new Date(),
        emailVerificationToken: null,
        emailVerificationExp: null,
      },
      select: { id: true, email: true },
    })

    return NextResponse.json({ success: true, message: "Email verified successfully", user })
  } catch {
    return NextResponse.json({ error: "Verification failed" }, { status: 400 })
  }
}
