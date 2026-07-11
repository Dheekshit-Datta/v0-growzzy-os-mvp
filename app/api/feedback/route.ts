import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { log } from "@/lib/logger"

export async function POST(req: NextRequest) {
  try {
    const session = await auth().catch(() => null)
    const body = await req.json().catch(() => ({}))
    const rating = Number(body.rating)
    const message = String(body.message || "").trim()
    const page = String(body.page || "/dashboard").slice(0, 300)
    const userAgent = String(body.userAgent || req.headers.get("user-agent") || "").slice(0, 500)

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Rating must be between 1 and 5" }, { status: 400 })
    }
    if (message.length < 3) {
      return NextResponse.json({ error: "Please add a little feedback before submitting" }, { status: 400 })
    }

    const feedback = await prisma.betaFeedback.create({
      data: {
        userId: session?.user?.id || null,
        rating,
        message,
        page,
        userAgent,
      },
    })

    return NextResponse.json({ ok: true, feedbackId: feedback.id })
  } catch (error: any) {
    log("error", "api/feedback", "Failed to save beta feedback", { message: error.message })
    return NextResponse.json({ error: "Could not save feedback right now" }, { status: 500 })
  }
}

