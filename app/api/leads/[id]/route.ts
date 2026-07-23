import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma, logSchemaHealthOnce } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { scoreLeadFit } from "@/lib/marketing-logic"
import { getRequestWorkspaceId } from "@/lib/workspace"
import { getActiveAdAccountScope } from "@/lib/account-scope"
import { logSlowApi } from "@/lib/api-timing"

export const dynamic = "force-dynamic"

function isMissingLeadAdAccountColumn(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "")
  return message.includes("Lead.adAccountId") && message.includes("does not exist")
}

function schemaMigrationRequiredResponse() {
  return NextResponse.json(
    {
      ok: false,
      code: "SCHEMA_MIGRATION_REQUIRED",
      error: "Leads schema is outdated. Run prisma migrate deploy to enable scoped lead access.",
      remediation: ["Run `prisma migrate deploy` on the production database.", "Refresh and retry lead operations."],
    },
    { status: 503 }
  )
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const startedAtMs = Date.now()
  try {
    await logSchemaHealthOnce()
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = await resolveUserId(session.user.id)
    const workspaceId = await getRequestWorkspaceId(userId, req)
    const accountScope = await getActiveAdAccountScope(userId, workspaceId, req.nextUrl.searchParams.get("adAccountId"))
    if (!accountScope) {
      return NextResponse.json({ error: "Connect and select an ad account first." }, { status: 409 })
    }
    const body = await req.json()

    let existing
    try {
      existing = await prisma.lead.findFirst({
        where: { id: params.id, userId, workspaceId, adAccountId: accountScope.adAccountId, deletedAt: null },
        select: { id: true, email: true, phone: true, company: true, status: true, source: true, value: true, notes: true },
      })
    } catch (error) {
      if (isMissingLeadAdAccountColumn(error)) return schemaMigrationRequiredResponse()
      throw error
    }
    if (!existing) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

    if (body.campaignId !== undefined && body.campaignId !== null) {
      if (typeof body.campaignId !== "string") return NextResponse.json({ error: "Invalid campaign" }, { status: 400 })
      const campaign = await prisma.campaign.findFirst({
        where: { id: body.campaignId, userId, workspaceId, adAccountId: accountScope.adAccountId },
        select: { id: true },
      })
      if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    const shouldRescore = ["email", "phone", "company", "status", "source", "value", "notes"].some((key) => body[key] !== undefined)
    const nextScore = shouldRescore
      ? scoreLeadFit({
          email: body.email !== undefined ? body.email : existing.email,
          phone: body.phone !== undefined ? body.phone : existing.phone,
          company: body.company !== undefined ? body.company : existing.company,
          status: body.status !== undefined ? body.status : existing.status,
          source: body.source !== undefined ? body.source : existing.source,
          value: body.value !== undefined ? body.value : existing.value,
          notes: body.notes !== undefined ? body.notes : existing.notes,
        })
      : null

    const lead = await prisma.lead.update({
      where: { id: existing.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.email !== undefined ? { email: body.email || null } : {}),
        ...(body.phone !== undefined ? { phone: body.phone || null } : {}),
        ...(body.company !== undefined ? { company: body.company || null } : {}),
        ...(body.status !== undefined ? { status: String(body.status).toUpperCase() } : {}),
        ...(body.source !== undefined ? { source: body.source } : {}),
        ...(body.value !== undefined ? { value: body.value === null ? null : Number(body.value) } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        ...(body.campaignId !== undefined ? { campaignId: body.campaignId || null } : {}),
        ...(nextScore ? { aiScore: nextScore.score, aiInsights: nextScore.reasoning, lastActivity: new Date() } : {}),
      },
    })

    return NextResponse.json({ ok: true, lead })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to update lead" }, { status: 500 })
  } finally {
    logSlowApi("/api/leads/[id]:patch", startedAtMs)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const startedAtMs = Date.now()
  try {
    await logSchemaHealthOnce()
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = await resolveUserId(session.user.id)
    const workspaceId = await getRequestWorkspaceId(userId, _req)
    const accountScope = await getActiveAdAccountScope(userId, workspaceId, _req.nextUrl.searchParams.get("adAccountId"))
    if (!accountScope) {
      return NextResponse.json({ error: "Connect and select an ad account first." }, { status: 409 })
    }

    let existing
    try {
      existing = await prisma.lead.findFirst({
        where: { id: params.id, userId, workspaceId, adAccountId: accountScope.adAccountId, deletedAt: null },
        select: { id: true },
      })
    } catch (error) {
      if (isMissingLeadAdAccountColumn(error)) return schemaMigrationRequiredResponse()
      throw error
    }
    if (!existing) return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    await prisma.lead.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    })

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to delete lead" }, { status: 500 })
  } finally {
    logSlowApi("/api/leads/[id]:delete", startedAtMs)
  }
}
