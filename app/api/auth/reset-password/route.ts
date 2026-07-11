import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"
    const limit = await rateLimit(`auth:reset:${ip}`, 8, 60_000, { strict: true })
    if (!limit.allowed) {
      return NextResponse.json({ error: limit.unavailable ? "Password reset is temporarily unavailable. Please try again shortly." : "Too many reset attempts. Please wait a moment." }, { status: limit.unavailable ? 503 : 429, headers: { "Retry-After": String(limit.retryAfter) } })
    }

    const { token, password } = await req.json()

    if (!token || !password) {
      return NextResponse.json({ error: "Reset token and password are required" }, { status: 400 })
    }

    if (String(password).length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
    }

    const user = await prisma.user.findFirst({
      where: {
        resetToken: String(token),
        resetTokenExp: { gt: new Date() },
      },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 401 })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: await bcrypt.hash(String(password), 12),
        resetToken: null,
        resetTokenExp: null,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Password updated successfully. Please sign in with your new password.",
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to reset password" }, { status: 500 })
  }
}
