import crypto from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendPasswordResetEmail } from "@/lib/email"
import { rateLimit } from "@/lib/rate-limit"
import { log } from "@/lib/logger"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"
    const limit = await rateLimit(`auth:forgot:${ip}`, 6, 60_000, { strict: true })
    if (!limit.allowed) {
      return NextResponse.json({ error: limit.unavailable ? "Password recovery is temporarily unavailable. Please try again shortly." : "Too many reset requests. Please wait a moment." }, { status: limit.unavailable ? 503 : 429, headers: { "Retry-After": String(limit.retryAfter) } })
    }

    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 })

    const normalizedEmail = String(email).toLowerCase().trim()
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true, email: true } })

    if (user) {
      const resetToken = crypto.randomBytes(32).toString("hex")
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken,
          resetTokenExp: new Date(Date.now() + 1000 * 60 * 30),
        },
      })
      const origin = new URL(req.url).origin
      sendPasswordResetEmail({
        email: user.email,
        resetUrl: `${origin}/auth/reset-password?token=${resetToken}`,
      }).catch((emailError: any) => {
        log("warn", "auth/forgot-password", "Password reset email failed or skipped", { message: emailError.message })
      })
    }

    return NextResponse.json({
      success: true,
      message: "If an account exists with this email, a password reset link has been generated.",
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to start password reset" }, { status: 500 })
  }
}
