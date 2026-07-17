import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const webhookSecret = process.env.GOOGLE_LEADS_WEBHOOK_SECRET
    const authHeader = req.headers.get("authorization")

    if (!webhookSecret) {
      return NextResponse.json({ error: "Google leads webhook is not configured" }, { status: 503 })
    }

    const providedToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : ""
    const expected = Buffer.from(webhookSecret, "utf8")
    const provided = Buffer.from(providedToken, "utf8")
    const authorized = expected.length === provided.length && crypto.timingSafeEqual(expected, provided)

    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized webhook" }, { status: 401 })
    }

    const body = await req.json()
    const userId = body.userId
    const workspaceId = body.workspaceId
    const adAccountId = body.adAccountId
    const leadPayload = body.lead || body
    if (!userId || !workspaceId || !adAccountId || !leadPayload?.name) {
      return NextResponse.json({ error: "userId, workspaceId, adAccountId and lead name are required" }, { status: 400 })
    }

    const integration = await prisma.integration.findFirst({
      where: {
        userId,
        workspaceId,
        platform: "GOOGLE",
        status: { in: ["OAUTH_GRANTED", "ACCOUNT_SELECTED", "INITIAL_SYNC_RUNNING", "ACTIVE", "SYNC_FAILED"] },
        hasAdsAccess: true,
        OR: [{ selectedAdAccountId: adAccountId }, { accountId: adAccountId }],
      },
      select: { id: true },
    })

    if (!integration) {
      return NextResponse.json({ error: "Webhook ad account is not authorized for this workspace." }, { status: 403 })
    }

    const lead = await prisma.lead.create({
      data: {
        userId,
        workspaceId,
        adAccountId,
        name: leadPayload.name,
        email: leadPayload.email || null,
        phone: leadPayload.phone || null,
        company: leadPayload.company || null,
        source: "GOOGLE_ADS",
        status: "NEW",
        value: leadPayload.value ? Number(leadPayload.value) : null,
        notes: "Captured from Google Ads Lead Form webhook",
      },
    })

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    })

    if (user?.email) {
      await sendEmail({
        to: user.email,
        subject: "New Google Ads Lead Captured",
        html: `<div style="font-family:Arial,sans-serif;"><h2>New lead captured</h2><p>${lead.name} from Google Ads has been added to your pipeline.</p></div>`,
        text: `New Google Ads lead captured: ${lead.name}`,
      })
    }

    return NextResponse.json({ ok: true, lead }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to process webhook" }, { status: 500 })
  }
}
