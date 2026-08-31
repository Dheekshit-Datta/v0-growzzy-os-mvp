import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma, logSchemaHealthOnce } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { sendEmail } from "@/lib/email"
import { scoreLeadFit } from "@/lib/marketing-logic"
import { getRequestWorkspaceId } from "@/lib/workspace"
import { getActiveAdAccountScope } from "@/lib/account-scope"
import { logSlowApi } from "@/lib/api-timing"
import type { Prisma } from "@prisma/client"

export const dynamic = "force-dynamic"

function isMissingLeadAdAccountColumn(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "")
  return message.includes("Lead.adAccountId") && message.includes("does not exist")
}

async function checkLeadSchema(): Promise<boolean> {
  try {
    await prisma.lead.findFirst({ where: { id: "00000000-0000-0000-0000-000000000000" }, select: { id: true, adAccountId: true }, take: 1 })
    return true
  } catch (error) {
    return !isMissingLeadAdAccountColumn(error)
  }
}

function schemaMigrationRequiredResponse() {
  return NextResponse.json(
    {
      ok: false,
      code: "SCHEMA_MIGRATION_REQUIRED",
      error: "Leads schema is outdated. Run prisma migrate deploy to enable account-scoped lead access.",
      remediation: ["Run `prisma migrate deploy` on the production database.", "Refresh and retry lead operations."],
    },
    { status: 503 }
  )
}

let SCHEMA_OK: boolean | null = null
async function ensureSchema(): Promise<boolean> {
  if (SCHEMA_OK !== null) return SCHEMA_OK
  SCHEMA_OK = await checkLeadSchema()
  return SCHEMA_OK
}

export async function GET(req: NextRequest) {
  const startedAtMs = Date.now()
  try {
    await logSchemaHealthOnce()
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!(await ensureSchema())) return schemaMigrationRequiredResponse()
    const userId = await resolveUserId(session.user.id)
    const workspaceId = await getRequestWorkspaceId(userId, req)
    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")
    const search = searchParams.get("search") || ""
    const requestedAdAccountId = searchParams.get("adAccountId")
    const accountScope = await getActiveAdAccountScope(userId, workspaceId, requestedAdAccountId)

    if (!accountScope) {
      return NextResponse.json({ ok: true, leads: [], accountRequired: true, message: "Connect and select an ad account to view account-specific leads." })
    }

    const baseWhere = {
      userId,
      workspaceId,
      deletedAt: null,
      ...(status && status !== "ALL"
        ? {
            status: {
              in: [status.toUpperCase(), status.toLowerCase()],
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
                { name: { contains: search, mode: "insensitive" as const } },
                { email: { contains: search, mode: "insensitive" as const } },
                { company: { contains: search, mode: "insensitive" as const } },
                { notes: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    }

    let leads
    try {
      leads = await prisma.lead.findMany({
        where: {
          ...baseWhere,
          adAccountId: accountScope.adAccountId,
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      })
    } catch (error) {
      if (isMissingLeadAdAccountColumn(error)) return schemaMigrationRequiredResponse()
      throw error
    }

    return NextResponse.json({ ok: true, leads })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to fetch leads" }, { status: 500 })
  } finally {
    logSlowApi("/api/leads:get", startedAtMs)
  }
}

export async function POST(req: NextRequest) {
  const startedAtMs = Date.now()
  try {
    await logSchemaHealthOnce()
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!(await ensureSchema())) return schemaMigrationRequiredResponse()
    const userId = await resolveUserId(session.user.id)
    const workspaceId = await getRequestWorkspaceId(userId, req)
    const { searchParams } = new URL(req.url)
    const accountScope = await getActiveAdAccountScope(userId, workspaceId, searchParams.get("adAccountId"))
    if (!accountScope) {
      return NextResponse.json({ error: "Connect and select an ad account before creating leads." }, { status: 409 })
    }
    const body = await req.json()

    if (!body?.name) return NextResponse.json({ error: "Lead name is required" }, { status: 400 })
    if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.email))) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 })
    }

    const initialScore = scoreLeadFit({
      source: body.source || "MANUAL",
      value: body.value !== undefined ? Number(body.value) : null,
      email: body.email || null,
      phone: body.phone || null,
      company: body.company || null,
      notes: body.notes || null,
      status: body.status || "NEW",
    })

    const leadData: Prisma.LeadUncheckedCreateInput & { adAccountId?: string | null } = {
      userId,
      workspaceId,
      adAccountId: accountScope.adAccountId,
      name: body.name,
      email: body.email || null,
      phone: body.phone || null,
      company: body.company || null,
      status: String(body.status || "NEW").toUpperCase(),
      source: body.source || "MANUAL",
      value: body.value !== undefined ? Number(body.value) : null,
      campaignId: body.campaignId || null,
      notes: body.notes || null,
      aiScore: initialScore.score,
      aiInsights: initialScore.reasoning,
      estimatedValue: body.value !== undefined ? Number(body.value) : null,
      lastActivity: new Date(),
    }

    let lead
    try {
      lead = await prisma.lead.create({ data: leadData })
    } catch (error) {
      if (isMissingLeadAdAccountColumn(error)) return schemaMigrationRequiredResponse()
      throw error
    }

    if (lead.email) {
      await sendEmail({
        to: lead.email,
        subject: "Welcome from GrowzzyOS",
        html: `<div style="font-family:Arial,sans-serif;"><h2>Hi ${lead.name},</h2><p>Thanks for connecting with GrowzzyOS. Our team will contact you shortly.</p></div>`,
        text: `Hi ${lead.name}, Thanks for connecting with GrowzzyOS.`,
      }).catch(() => undefined)
    }

    return NextResponse.json({ ok: true, lead }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to create lead" }, { status: 500 })
  } finally {
    logSlowApi("/api/leads:post", startedAtMs)
  }
}
