import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { rateLimitPolicy, rateLimitResponse } from "@/lib/rate-limit"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId } from "@/lib/workspace"
import { assertCreditsAvailable, estimatedCredits, recordCreditUsage, CreditQuotaError } from "@/lib/ai-credits"
import { getBusinessContextForWorkspace, normalizeBusinessContext } from "@/lib/business-context"
import { buildPsychologyPromptContext } from "@/lib/ad-psychology-engine"
import { log } from "@/lib/logger"
import { aiErrorMetadata } from "@/lib/ai-utility"
import { BANNED_FILLER_PHRASES } from "@/lib/google-plan-quality"
import { scoreCreativeQuality } from "@/lib/creative-quality-score"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" })

const HeadlineAngleEnum = z.enum(["pain_point", "solution", "urgency", "cta", "feature", "question", "social_proof", "risk_reversal"])

const AWARENESS_DIRECTIVES: Record<string, string> = {
  PROBLEM_AWARE: "Lead with the visceral pain point they feel daily. Name the symptom.",
  SOLUTION_AWARE: "Lead with your unique mechanism and speed of execution. Differentiate from alternatives.",
  PRODUCT_AWARE: "Lead with differentiation vs named competitors and proof (numbers, testimonials, results).",
  MOST_AWARE: "Lead with the risk-reversal offer, price, and immediate CTA. Remove purchase friction.",
  UNKNOWN: "Default to PROBLEM_AWARE — name a sharp pain point that pulls the reader in.",
}

function awarenessDirective(stage: string | null | undefined): string {
  return AWARENESS_DIRECTIVES[stage ?? ""] ?? AWARENESS_DIRECTIVES.UNKNOWN
}

const GenerateAdCopyInputSchema = z.object({
  goal: z.string().min(2, "Goal is required").max(120),
  type: z.string().optional().default("SEARCH"),
  theme: z.string().min(2, "Theme is required").max(200),
  targetCustomer: z.string().min(2, "Target customer is required for psychology-grounded copy").max(200),
  keywords: z.array(z.string().max(100)).optional().default([]),
  finalUrl: z.string().url().optional().or(z.literal("")),
})

const AdCopyResponseSchema = z.object({
  headlines: z.array(z.object({
    text: z.string().trim().min(1),
    angle: HeadlineAngleEnum,
  })),
  descriptions: z.array(z.object({
    text: z.string().trim().min(1),
  })),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = await resolveUserId(session.user.id)
  const workspaceId = await getRequestWorkspaceId(userId, req)
  const limit = await rateLimitPolicy(userId, "creativeText")
  if (!limit.allowed) return rateLimitResponse(limit)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body JSON." }, { status: 400 })
  }

  const parsedInput = GenerateAdCopyInputSchema.safeParse(body)
  if (!parsedInput.success) {
    return NextResponse.json({ ok: false, error: parsedInput.error.issues[0]?.message || "Invalid input parameters." }, { status: 400 })
  }

  const { goal, type, theme, targetCustomer, keywords, finalUrl } = parsedInput.data

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ ok: false, error: "AI ad copy generation is unavailable because OPENAI_API_KEY is not configured." }, { status: 503 })
  }

  const model = process.env.OPENAI_CAMPAIGN_BUILDER_MODEL || "gpt-4o"
  try {
    await assertCreditsAvailable(workspaceId, estimatedCredits(model))
  } catch (error) {
    if (error instanceof CreditQuotaError) return NextResponse.json({ ok: false, error: "Monthly credit quota exceeded. Try again after the workspace credits reset." }, { status: 402 })
    throw error
  }

  const rawBusinessContext = await getBusinessContextForWorkspace(workspaceId)
  const businessContext = normalizeBusinessContext(rawBusinessContext)

  const psychologyProfile = await buildPsychologyPromptContext({
    offer: theme,
    targetCustomer: targetCustomer,
    goal,
    brandMemory: businessContext,
    landingPageUrl: finalUrl,
    workspaceId,
    userId,
  })

  const systemPrompt = `You are the world's best direct-response copywriter. You write ads that make people stop, feel, and click. Your copy has converted billions in revenue. Your writing is sharp, quantified, and specific.

COPYWRITING STANDARDS — every headline must pass ALL of these:

THE 4U'S TEST:
✗ BAD: "Get More Leads" (vague, no specificity, no urgency)
✓ GOOD: "Close 40% More Leads in 30 Days" (specific, quantified, outcome-driven)

EMOTIONAL TRIGGER TEST:
✗ BAD: "Best CRM Software" (feature claim, no emotion)
✓ GOOD: "Stop Losing Leads to Your Competitors" (fear of loss, visceral)

CURIiosity GAP TEST:
✗ BAD: "Our AI Tool Saves Time" (complete statement, no gap)
✓ GOOD: "The 7-Minute Fix for 4-Hour Tasks" (opens a curiosity gap)

PAIN vs FEATURE TEST:
✗ BAD: "Cloud-based, AI-powered CRM" (features nobody asked about)
✓ GOOD: "Finally, a CRM Your Team Will Actually Use" (addresses adoption fear)

SPECIFICITY TEST:
✗ BAD: "Save time and money" (generic)
✓ GOOD: "Cut admin by 3 hours/week — free in 14 days" (quantified, risk-reversed)

HEADLINE FORMULA (use at least one per ad group):
- NUMBER + OUTCOME: "Close 40% More Leads in 30 Days"
- FEAR OF LOSS: "Stop Losing Deals to Competitors"
- HOW-TO FRAME: "How [Specific Audience] Gets [Specific Outcome]"
- CURIOUSITY GAP: "The [X]-Minute Fix for [Pain]"
- SOCIAL PROOF: "500+ [Persona] Trust This Approach"
- CONTRAST/BEFORE-AFTER: "From [Bad] to [Great] in [Time]"

DESCRIPTION FORMULA — each description must include:
- WHO this is for (specific persona) - WHAT transformation they're getting
- WHY it's different from alternatives
- CTA that removes friction

BANNED PHRASES: 'Unlock AI Efficiency' | 'Revitalize Operations' | 'Transform Your Business' | 'Reduce Costs With AI' | 'Seamless' | 'Revolutionary' | 'Best-in-Class' | 'World-Class' | 'State-of-the-Art' | 'Holistic'

STRUCTURAL RULES:
- Generate 12-15 unique headlines, each strictly <= 30 characters
- Generate 4 compelling descriptions, each strictly <= 90 characters
- Minimum 3 headlines MUST contain the offer name or brand token
- Cover ALL 6 psychological angles: pain_point, solution, urgency, cta, social_proof, risk_reversal
- AWARENESS DIRECTIVE: ${awarenessDirective(psychologyProfile.awarenessStage)}
- No fabricated stats, no "#1" claims, no "100% Guaranteed"

RETURN ONLY valid JSON matching the schema. No preamble.`

  const userPromptLines = [
    `Generate high-converting direct-response Responsive Search Ad (RSA) copy:`,
    `Campaign Goal: ${goal}`,
    `Campaign Type: ${type}`,
    `Ad Group Theme: ${theme}`,
    `Target Customer: ${targetCustomer} (${psychologyProfile.targetPersona})`,
    keywords.length ? `Keywords: ${JSON.stringify(keywords)}` : null,
    finalUrl ? `Landing Page: ${finalUrl}` : null,
    `Target Awareness Stage: ${psychologyProfile.awarenessStage}`,
    `Core Pain Points: ${psychologyProfile.corePainPoints.join(" | ")}`,
    `Desired Outcomes: ${psychologyProfile.desireOutcomes.join(" | ")}`,
    `Emotional Trigger: ${psychologyProfile.primaryEmotionalTrigger}`,
    businessContext ? `Brand Context: ${businessContext}` : null,
    `
Return ONLY JSON:
{
  "headlines": [
    { "text": "Headline strictly <= 30 chars", "angle": "pain_point|solution|urgency|cta|feature|social_proof|risk_reversal" }
  ],
  "descriptions": [
    { "text": "Description strictly <= 90 chars" }
  ]
}`,
  ].filter(Boolean).join("\n")

  let validatedData: z.infer<typeof AdCopyResponseSchema> | null = null
  let lastError: unknown = null

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const completion = await openai.chat.completions.create({
        model,
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `${userPromptLines}${attempt ? "\n\nThe previous attempt had invalid structure or insufficient headlines. Return at least 10 headlines (<=30 chars) and 3-4 descriptions (<=90 chars)." : ""}` },
        ],
      })

      await recordCreditUsage({
        workspaceId,
        userId,
        route: "/api/ai/generate-ad-copy",
        model,
        inputTokens: completion.usage?.prompt_tokens,
        outputTokens: completion.usage?.completion_tokens,
      })

      const rawContent = completion.choices[0]?.message?.content || "{}"
      const parsedJson = JSON.parse(rawContent)
      const validated = AdCopyResponseSchema.safeParse(parsedJson)

      if (validated.success && validated.data.headlines.length >= 8 && validated.data.descriptions.length >= 2) {
        validatedData = validated.data
        break
      }
    } catch (error) {
      lastError = error
      log("error", "ai/generate-ad-copy", `Ad copy generation attempt ${attempt + 1} failed`, aiErrorMetadata(error))
    }
  }

  if (!validatedData) {
    return NextResponse.json({ ok: false, error: "Failed to generate valid direct-response ad copy. Please add more details and retry." }, { status: 502 })
  }

  const headlines = validatedData.headlines
    .map((h) => ({
      text: h.text.slice(0, 30),
      angle: h.angle,
    }))
    .filter((h) => h.text.length > 0)
    .slice(0, 15)

  const descriptions = validatedData.descriptions
    .map((d) => ({
      text: d.text.slice(0, 90),
    }))
    .filter((d) => d.text.length > 0)
    .slice(0, 4)

  // Validate angle diversity - ensure we have good coverage across psychological angles
  const uniqueAngles = new Set(headlines.map(h => h.angle))
  if (uniqueAngles.size < 3) {
    return NextResponse.json({
      ok: false,
      error: `Ad copy lacks angle diversity. Found only ${uniqueAngles.size} distinct angles (${Array.from(uniqueAngles).join(', ')}). Need at least 3 different angles like pain_point, solution, urgency, etc.`
    }, { status: 502 })
  }

  // Mixed-content quality checks
  const headlineTexts = validatedData.headlines.map((h: any) => h.text.toLowerCase().trim())
  const angleCounts: Record<string, number> = {}
  headlineTexts.forEach((h) => {
    if (/(pain|frust|issue|problem)/i.test(h)) angleCounts["pain_point"] = (angleCounts["pain_point"] || 0) + 1
    if (/(help|fix|solve|answer|method)/i.test(h)) angleCounts["solution"] = (angleCounts["solution"] || 0) + 1
    if (/(now|today|hurry|limited|act now)/i.test(h)) angleCounts["urgency"] = (angleCounts["urgency"] || 0) + 1
    if (/(buy|order|purchase|shop|get)/i.test(h)) angleCounts["cta"] = (angleCounts["cta"] || 0) + 1
    if (/(review|testimonial|proof|trusted)/i.test(h)) angleCounts["social_proof"] = (angleCounts["social_proof"] || 0) + 1
    if (/(guarantee|refund|risk-free|warranty)/i.test(h)) angleCounts["risk_reversal"] = (angleCounts["risk_reversal"] || 0) + 1
  })

  const missingAngles = [...new Set(["pain_point", "solution", "urgency", "cta", "social_proof", "risk_reversal"])].filter(a => !uniqueAngles.has(a))
  if (missingAngles.length > 0) {
    return NextResponse.json({
      ok: false,
      error: `Copy quality issue: missing psychological angles (found ${uniqueAngles.size}/6): ${missingAngles.join(", ")}. Headlines should cover pain, solution, urgency, CTA, social proof, and risk reversal.`
    }, { status: 502 })
  }

  // Detect filler phrases
  const foundFillers = headlineTexts.filter((h) => BANNED_FILLER_PHRASES.some(f => h.toLowerCase().includes(f)))
  if (foundFillers.length > 0) {
    return NextResponse.json({
      ok: false,
      error: `Copy quality issue: found ${foundFillers.length} filler phrase matches. Banned: ${BANNED_FILLER_PHRASES.join(" | ")}`
    }, { status: 502 })
  }

  // Check for same headline stem across groups
  const stemCounts: Record<string, number> = {}
  headlineTexts.forEach((h) => {
    const stem = h.replace(/[^\w\s]/g, "").split(" ")[0] || ""
    if (stem) stemCounts[stem] = (stemCounts[stem] || 0) + 1
  })
  const duplicateStems = Object.entries(stemCounts).filter(([, c]) => c > 1).length
  if (duplicateStems > 2) {
    return NextResponse.json({
      ok: false,
      error: `Copy quality issue: ${duplicateStems} headline stems are duplicated across headlines. Each headline should have a unique focus.`
    }, { status: 502 })
  }

  // Weighted quality score check — fail if total < 70
  const qscore = scoreCreativeQuality(
    validatedData.headlines.map((h: any) => h.text),
    validatedData.descriptions.map((d: any) => d.text),
    theme,
    targetCustomer
  )
  if (!qscore.passed) {
    log("info", "ai/generate-ad-copy", `Creative quality score: ${qscore.total}/100 — ${qscore.dimensions.angleCoverage.reason}`)
    return NextResponse.json({
      ok: false,
      error: `Creative quality score: ${qscore.total}/70. Issues: ${qscore.dimensions.angleCoverage.reason}. ${qscore.dimensions.specificity.reason}. Add more specificity, emotional triggers, and offer references.`,
    }, { status: 502 })
  }

  return NextResponse.json({ ok: true, headlines, descriptions, psychologyProfile })
}

