import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId } from "@/lib/workspace"
import { rateLimitPolicy, rateLimitResponse } from "@/lib/rate-limit"
import { parseGoogleSearchPlan, BANNED_FILLER_PHRASES } from "@/lib/google-plan-quality"
import { scoreCreativeQuality } from "@/lib/creative-quality-score"
import { aiErrorMetadata } from "@/lib/ai-utility"
import { assertCreditsAvailable, estimatedCredits, recordCreditUsage, CreditQuotaError } from "@/lib/ai-credits"
import { log } from "@/lib/logger"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" })

/**
 * Campaign Builder Edit Mode
 *
 * Two modes:
 * 1. "fix" — auto-revise underperforming copy in place (silent regen of bad headlines)
 * 2. "comment" — produce structured inline comments on what to improve
 */

const EditRequestSchema = z.object({
  planId: z.string().min(1),
  mode: z.enum(["fix", "comment"]),
  scope: z.enum(["all", "adGroup"]).default("all"),
  adGroupName: z.string().optional(),
  focusAngles: z.array(z.enum(["pain_point", "solution", "urgency", "cta", "feature", "social_proof", "risk_reversal", "question"])).optional(),
  notes: z.string().max(500).optional(),
})

type EditReport = {
  planId: string
  mode: "fix" | "comment"
  updated: boolean
  changes: Array<{
    adGroup: string
    field: "headline" | "description"
    index: number
    before: string
    after: string
    reason: string
  }>
  comments: Array<{
    adGroup: string
    field: "headline" | "description"
    index: number
    text: string
    severity: "info" | "warning" | "error"
  }>
  qualityBefore: number
  qualityAfter: number
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = await resolveUserId(session.user.id)
  const limit = await rateLimitPolicy(userId, "campaignPlan")
  if (!limit.allowed) return rateLimitResponse(limit)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: { code: "INVALID_JSON", message: "Invalid request body." } }, { status: 400 })
  }

  const parsed = EditRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: { code: "INVALID_INPUT", message: parsed.error.issues[0]?.message || "Invalid edit request." } }, { status: 400 })
  }
  const input = parsed.data
  const workspaceId = await getRequestWorkspaceId(userId, req)

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ ok: false, error: { code: "AI_UNAVAILABLE", message: "AI editing is temporarily unavailable." } }, { status: 503 })
  }

  const model = process.env.OPENAI_CAMPAIGN_BUILDER_MODEL || "gpt-4o"
  try {
    await assertCreditsAvailable(workspaceId, estimatedCredits(model))
  } catch (error) {
    if (error instanceof CreditQuotaError) return NextResponse.json({ ok: false, error: { code: error.code, message: "Monthly credit quota exceeded." } }, { status: 402 })
    throw error
  }

  const plan = await prisma.campaignPlan.findFirst({
    where: { id: input.planId, userId, workspaceId },
  })
  if (!plan) {
    return NextResponse.json({ ok: false, error: { code: "PLAN_NOT_FOUND", message: "Campaign plan not found." } }, { status: 404 })
  }

  const planData = plan.plan as any
  const adGroups: any[] = planData.adGroups || []
  const targetAdGroups = input.scope === "adGroup" && input.adGroupName
    ? adGroups.filter(g => g.name === input.adGroupName)
    : adGroups

  if (targetAdGroups.length === 0) {
    return NextResponse.json({ ok: false, error: { code: "ADGROUP_NOT_FOUND", message: "Target ad group not found in plan." } }, { status: 404 })
  }

  const qualityBefore = avgQuality(targetAdGroups, planData.briefInput || planData)

  const report: EditReport = {
    planId: plan.id,
    mode: input.mode,
    updated: false,
    changes: [],
    comments: [],
    qualityBefore,
    qualityAfter: qualityBefore,
  }

  for (const group of targetAdGroups) {
    if (input.mode === "fix") {
      const result = await fixAdGroup(group, input, model, workspaceId, userId)
      if (result.changed) {
        report.changes.push(...result.changes)
        Object.assign(group, { headlines: result.headlines, descriptions: result.descriptions })
      }
    } else {
      const comments = await commentAdGroup(group, input, model, workspaceId, userId)
      report.comments.push(...comments)
    }
  }

  if (input.mode === "fix" && report.changes.length > 0) {
    const candidateRaw = { ...planData, adGroups }
    const validated = parseGoogleSearchPlan(candidateRaw)
    if (validated.plan) {
      planData.adGroups = validated.plan.adGroups
      await prisma.campaignPlan.update({
        where: { id: plan.id },
        data: { plan: planData },
      })
      report.updated = true
    } else {
      log("warn", "ai/campaign-builder/edit", "Edited plan failed re-validation; not persisting", { planId: plan.id, errors: validated.error })
    }
  }

  if (input.mode === "fix" && report.updated) {
    report.qualityAfter = avgQuality(targetAdGroups, planData.briefInput || planData)
  }

  return NextResponse.json({ ok: true, report })
}

async function fixAdGroup(
  group: any,
  input: z.infer<typeof EditRequestSchema>,
  model: string,
  workspaceId: string,
  userId: string
): Promise<{
  changed: boolean
  headlines: string[]
  descriptions: string[]
  changes: EditReport["changes"]
}> {
  const headlines: string[] = group.headlines || []
  const descriptions: string[] = group.descriptions || []

  // Find low-quality lines: filler, off-angle, weak
  const issues: Array<{ idx: number; field: "headline" | "description"; reason: string }> = []
  headlines.forEach((h, i) => {
    if (BANNED_FILLER_PHRASES.some(f => h.toLowerCase().includes(f))) issues.push({ idx: i, field: "headline", reason: "banned filler phrase" })
    if (h.length > 30) issues.push({ idx: i, field: "headline", reason: "over 30 char limit" })
    if (/^(get more|best|top|amazing)\s/i.test(h)) issues.push({ idx: i, field: "headline", reason: "generic weak opener" })
  })
  descriptions.forEach((d, i) => {
    if (BANNED_FILLER_PHRASES.some(f => d.toLowerCase().includes(f))) issues.push({ idx: i, field: "description", reason: "banned filler phrase" })
  })

  if (issues.length === 0) {
    return { changed: false, headlines, descriptions, changes: [] }
  }

  const systemPrompt = `You are the world's best direct-response copywriter. Your job: rewrite underperforming RSA copy to be sharp, quantified, and specific.

REWRITE RULES:
- Headlines: strictly <= 30 characters. Use formulas: NUMBER+OUTCOME, FEAR OF LOSS, HOW-TO, CURIOSITY GAP, SOCIAL PROOF, CONTRAST.
- Descriptions: strictly <= 90 characters. Include WHO, WHAT, WHY, CTA.
- No banned phrases (seamless, revolutionary, world-class, holistic, transform, etc).
- Banned: 'Unlock AI Efficiency', 'Revitalize Operations', 'Transform Your Business', 'Reduce Costs With AI'.
- If given focusAngles, prioritize those angles in your rewrites.

RETURN ONLY valid JSON:
{
  "rewrites": [
    { "field": "headline|description", "index": <int>, "before": "<original>", "after": "<rewrite>", "reason": "<why>" }
  ]
}`

  const userPrompt = `Ad Group: ${group.name}
Theme: ${group.theme}
Focus angles: ${input.focusAngles?.join(", ") || "any"}
${input.notes ? `Additional notes: ${input.notes}` : ""}

Underperforming lines to rewrite:
${issues.map(i => `[${i.field} ${i.idx}] ${i.field === "headline" ? headlines[i.idx] : descriptions[i.idx]} — ${i.reason}`).join("\n")}

Return ONLY the JSON.`

  try {
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.7,
      response_format: { type: "json_object" as const },
      messages: [
        { role: "system" as const, content: systemPrompt },
        { role: "user" as const, content: userPrompt },
      ],
    })
    await recordCreditUsage({
      workspaceId,
      userId,
      route: "/api/ai/campaign-builder/edit",
      model,
      inputTokens: completion.usage?.prompt_tokens,
      outputTokens: completion.usage?.completion_tokens,
    })

    const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}")
    const changes: EditReport["changes"] = []
    const newHeadlines = [...headlines]
    const newDescriptions = [...descriptions]

    for (const r of parsed.rewrites || []) {
      const after = String(r.after || "").trim()
      if (!after) continue
      if (r.field === "headline" && r.index < newHeadlines.length) {
        const before = newHeadlines[r.index]
        newHeadlines[r.index] = after.slice(0, 30)
        changes.push({ adGroup: group.name, field: "headline", index: r.index, before, after: newHeadlines[r.index], reason: r.reason || "auto-fix" })
      } else if (r.field === "description" && r.index < newDescriptions.length) {
        const before = newDescriptions[r.index]
        newDescriptions[r.index] = after.slice(0, 90)
        changes.push({ adGroup: group.name, field: "description", index: r.index, before, after: newDescriptions[r.index], reason: r.reason || "auto-fix" })
      }
    }

    return { changed: changes.length > 0, headlines: newHeadlines, descriptions: newDescriptions, changes }
  } catch (error) {
    log("error", "ai/campaign-builder/edit", `Fix failed for ad group ${group.name}`, aiErrorMetadata(error))
    return { changed: false, headlines, descriptions, changes: [] }
  }
}

async function commentAdGroup(
  group: any,
  input: z.infer<typeof EditRequestSchema>,
  model: string,
  workspaceId: string,
  userId: string
): Promise<EditReport["comments"]> {
  const headlines: string[] = group.headlines || []
  const descriptions: string[] = group.descriptions || []
  const comments: EditReport["comments"] = []

  // Local rules-based comments (no API call needed for these)
  headlines.forEach((h, i) => {
    if (BANNED_FILLER_LOCAL(h)) comments.push({ adGroup: group.name, field: "headline", index: i, text: `"${h}" contains a banned filler phrase.`, severity: "error" })
    if (h.length > 30) comments.push({ adGroup: group.name, field: "headline", index: i, text: `"${h}" is ${h.length} chars (max 30).`, severity: "error" })
    if (IS_GENERIC(h)) comments.push({ adGroup: group.name, field: "headline", index: i, text: `"${h}" is generic — add a specific number, mechanism, or proof.`, severity: "warning" })
    if (!HAS_NUMERIC(h) && i % 3 === 0) comments.push({ adGroup: group.name, field: "headline", index: i, text: `"${h}" lacks specificity — consider adding a number or timeframe.`, severity: "info" })
  })
  descriptions.forEach((d, i) => {
    if (BANNED_FILLER_LOCAL(d)) comments.push({ adGroup: group.name, field: "description", index: i, text: `"${d}" contains a banned filler phrase.`, severity: "error" })
    if (d.length > 90) comments.push({ adGroup: group.name, field: "description", index: i, text: `"${d}" is ${d.length} chars (max 90).`, severity: "error" })
  })

  // Optionally enrich with AI-powered angle-mix recommendations
  try {
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.3,
      response_format: { type: "json_object" as const },
      messages: [
        { role: "system" as const, content: "You are a direct-response advertising critic. Given RSA copy, return a JSON of 1-3 high-level comments focusing on angle mix, offer presence, and emotional trigger variety. Format: {\"comments\": [{\"text\": \"...\", \"severity\": \"info|warning|error\"}]}" },
        { role: "user" as const, content: `Ad Group: ${group.name}\nTheme: ${group.theme}\nHeadlines: ${JSON.stringify(headlines)}\nDescriptions: ${JSON.stringify(descriptions)}` },
      ],
    })
    await recordCreditUsage({
      workspaceId,
      userId,
      route: "/api/ai/campaign-builder/edit",
      model,
      inputTokens: completion.usage?.prompt_tokens,
      outputTokens: completion.usage?.completion_tokens,
    })
    const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}")
    for (const c of parsed.comments || []) {
      comments.push({
        adGroup: group.name,
        field: "headline",
        index: -1,
        text: String(c.text || ""),
        severity: (c.severity === "error" || c.severity === "warning") ? c.severity : "info",
      })
    }
  } catch (error) {
    log("warn", "ai/campaign-builder/edit", `Comment enrichment failed for ${group.name}`, aiErrorMetadata(error))
  }

  return comments
}

function BANNED_FILLER_LOCAL(text: string): boolean {
  return BANNED_FILLER_PHRASES.some(f => text.toLowerCase().includes(f))
}
function IS_GENERIC(h: string): boolean {
  return /^(get more|best|top|amazing|ultimate|powerful)\s/i.test(h) || /^(welcome to|introducing|now offering)\b/i.test(h)
}
function HAS_NUMERIC(h: string): boolean {
  return /\d/.test(h) || /\$\d+/.test(h)
}

function avgQuality(adGroups: any[], _brief: any): number {
  if (adGroups.length === 0) return 0
  const scores = adGroups.map(g => scoreCreativeQuality(
    g.headlines || [],
    g.descriptions || [],
    _brief?.offer || _brief?.productOrOffer || "",
    _brief?.targetCustomer
  ).total)
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
}
