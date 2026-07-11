export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { log } from "@/lib/logger"
import { sendEmailVerification, sendWelcomeEmail } from "@/lib/email"
import { rateLimit } from "@/lib/rate-limit"
import crypto from "crypto"

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"
    const limit = await rateLimit(`auth:register:${ip}`, 5, 60_000, { strict: true })
    if (!limit.allowed) {
      return NextResponse.json({ error: limit.unavailable ? "Signup protection is temporarily unavailable. Please try again shortly." : "Too many signup attempts. Please wait a moment." }, { status: limit.unavailable ? 503 : 429, headers: { "Retry-After": String(limit.retryAfter) } })
    }

    const { email, password, name } = await req.json()
    const normalizedEmail = String(email || "").toLowerCase().trim()
    const displayName = String(name || "").trim()

    if (!normalizedEmail || !password || !displayName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
    }

    // Check if user already exists
    let existingUser = null
    try {
      existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail }
      })
    } catch (dbError: any) {
      log("error", "auth/register", "Database connection error", { message: dbError.message })
      if (dbError.message.includes("reaching") || dbError.message.includes("authentication") || dbError.message.includes("reach")) {
        return NextResponse.json({
          error: "Unable to reach the database. This usually means DATABASE_URL in the current environment is incorrect or the database is unavailable.",
          details: dbError.message
        }, { status: 503 })
      }
      throw dbError // Re-throw if it's an unexpected error
    }

    if (existingUser) {
      return NextResponse.json({
        error: "An account with this email already exists. Sign in instead?",
        code: "EMAIL_EXISTS",
      }, { status: 409 })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)
    const verificationToken = crypto.randomBytes(32).toString("hex")

    // Create user in database
    try {
      const user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          password: hashedPassword,
          name: displayName,
          emailVerified: null,
          emailVerificationToken: verificationToken,
          emailVerificationExp: new Date(Date.now() + 24 * 60 * 60 * 1000),
          onboardingStep: 0,
          onboardingCompleted: false,
        }
      })

      sendWelcomeEmail({ email: user.email, name: user.name }).catch((emailError: any) => {
        log("warn", "auth/register", "Welcome email skipped or failed", { message: emailError.message })
      })
      const origin = new URL(req.url).origin
      sendEmailVerification({
        email: user.email,
        name: user.name,
        verifyUrl: `${origin}/auth/verify-email?token=${verificationToken}`,
      }).catch((emailError: any) => {
        log("warn", "auth/register", "Verification email skipped or failed", { message: emailError.message })
      })

      return NextResponse.json({
        success: true,
        message: "Account created successfully",
        userId: user.id,
      })
    } catch (createError: any) {
      log("error", "auth/register", "Create user error", { message: createError.message })
      return NextResponse.json({
        error: "Failed to create user record. The database might be offline or using restricted credentials.",
        details: createError.message
      }, { status: 500 })
    }
  } catch (error: any) {
    log("error", "auth/register", "Registration error", { message: error.message })
    return NextResponse.json({ error: error.message || "Registration failed" }, { status: 500 })
  }
}
