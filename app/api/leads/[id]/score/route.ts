import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { auth } from "@/lib/auth"
import { prisma, logSchemaHealthOnce } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { scoreLeadFit } from "@/lib/marketing-logic"
import { getRequestWorkspaceId } from "@/lib/workspace"
import { getActiveAdAccountScope } from "@/lib/account-scope"
import { logSlowApi } from "@/lib/api-timing"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" })

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
      error: "Leads schema is outdated. Run prisma migrate deploy to enable scoped lead scoring.",
      remediation: ["Run `prisma migrate deploy` on the production database.", "Refresh and retry lead scoring."],
    },
    { status: 503 }
  )
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const startedAtMs = Date.now()
  try {
    await logSchemaHealthOnce()
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = await resolveUserId(session.user.id)
    const workspaceId = await getRequestWorkspaceId(userId, _req)
    const accountScope = await getActiveAdAccountScope(userId, workspaceId, _req.nextUrl.searchParams.get("adAccountId"))
    if (!accountScope) return NextResponse.json({ error: "Connect and select an ad account first." }, { status: 409 })

    let lead
    try {
      lead = await prisma.lead.findFirst({
        where: { id: params.id, userId, workspaceId, adAccountId: accountScope.adAccountId, deletedAt: null },
      })
    } catch (error) {
      if (isMissingLeadAdAccountColumn(error)) return schemaMigrationRequiredResponse()
      throw error
    }
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

    const deterministic = scoreLeadFit(lead)
    let reasoning = deterministic.reasoning
    let score = deterministic.score

    if (process.env.OPENAI_API_KEY) {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        temperature: 0.25,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'You are a lead qualification analyst for an SMMA agency. Return ONLY JSON: {"score":0-100,"reasoning":"short concrete explanation","nextAction":"one recommended sales action"}. Use the deterministic baseline but adjust only if the lead details justify it.',
          },
          {
            role: "user",
            content: JSON.stringify({ deterministicBaseline: deterministic, lead }),
          },
        ],
      })
      try {
        const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}")
        score = Math.max(0, Math.min(100, Number(parsed.score ?? score)))
        reasoning = [parsed.reasoning, parsed.nextAction ? `Next action: ${parsed.nextAction}` : null].filter(Boolean).join("\n")
      } catch {
        reasoning = deterministic.reasoning
      }
    }

    const updated = await prisma.lead.update({
      where: { id: lead.id },
      data: { aiScore: Math.round(score), aiInsights: reasoning, lastActivity: new Date() },
    })

    return NextResponse.json({ ok: true, score: updated.aiScore, reasoning: updated.aiInsights, lead: updated })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to score lead" }, { status: 500 })
  } finally {
    logSlowApi("/api/leads/[id]/score:post", startedAtMs)
  }
}
