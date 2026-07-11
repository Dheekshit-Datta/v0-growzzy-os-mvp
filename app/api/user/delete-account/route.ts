import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { rateLimit } from "@/lib/rate-limit"
import { log } from "@/lib/logger"

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const limit = await rateLimit(`delete-account:${session.user.id}`, 3, 60_000)
    if (!limit.allowed) {
      return NextResponse.json({ error: limit.unavailable ? "Account deletion protection is temporarily unavailable. Please try again shortly." : "Too many delete attempts. Please wait a moment." }, { status: limit.unavailable ? 503 : 429, headers: { "Retry-After": String(limit.retryAfter) } })
    }

    const body = await req.json().catch(() => ({}))
    if (String(body.confirm || "").trim() !== "DELETE") {
      return NextResponse.json({ error: "Type DELETE to confirm account deletion" }, { status: 400 })
    }

    const userId = await resolveUserId(session.user.id)

    await prisma.$transaction(async (tx) => {
      await tx.integration.deleteMany({ where: { userId } })
      await tx.user.delete({ where: { id: userId } })
    })

    return NextResponse.json({ ok: true, message: "Account and associated data deleted" })
  } catch (error: any) {
    log("error", "api/user/delete-account", "Failed to delete account", { message: error.message })
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 })
  }
}
