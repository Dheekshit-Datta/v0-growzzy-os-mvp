import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { resolveUserId } from "@/lib/resolve-user"
import { rateLimitPolicy, rateLimitResponse } from "@/lib/rate-limit"
import { getRequestWorkspaceId } from "@/lib/workspace"
import { getBusinessContextForWorkspace } from "@/lib/business-context"
import { aiErrorMetadata, aiUnavailableMessage, cachedUtilityCompletion } from "@/lib/ai-utility"
import { log } from "@/lib/logger"
import { CreditQuotaError } from "@/lib/ai-credits"

const EnhanceSchema = z.object({
  prompt: z.string().min(3).max(2000),
  budget: z.coerce.number().positive().optional(),
  location: z.string().max(120).optional(),
  goal: z.string().max(80).optional(),
  brandContext: z.string().max(8000).optional(),
})

const EnhancedBriefSchema = z.object({
  enhancedText: z.string().min(20).max(2000),
  productOrOffer: z.string().min(2).max(300),
  targetCustomer: z.string().min(2).max(500),
  painPoints: z.array(z.string().min(2).max(200)).max(4),
  differentiators: z.array(z.string().min(2).max(200)).max(4),
  proofPoints: z.array(z.string().min(2).max(200)).max(4),
  geography: z.string().max(120),
  goal: z.string().max(80),
  tone: z.string().max(80),
  restrictions: z.array(z.string().min(2).max(200)).max(4),
  missingQuestions: z.array(z.string().min(3).max(180)).max(3),
})

function parseBrief(content: string) {
  try {
    return EnhancedBriefSchema.safeParse(JSON.parse(content))
  } catch {
    return EnhancedBriefSchema.safeParse(null)
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 })
  const userId = await resolveUserId(session.user.id)
  const limit = await rateLimitPolicy(userId, "aiUtility")
  if (!limit.allowed) return rateLimitResponse(limit)

  const body = await req.json().catch(() => null)
  const parsed = EnhanceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: { code: "INVALID_INPUT", message: parsed.error.issues[0]?.message || "Invalid prompt" } }, { status: 400 })
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ ok: false, error: { code: "AI_UNAVAILABLE", message: "AI Enhance is temporarily unavailable. Your original brief has not been changed." } }, { status: 503 })
  }

  const input = parsed.data
  const workspaceId = await getRequestWorkspaceId(userId, req)
  const businessContext = await getBusinessContextForWorkspace(workspaceId)
  const prompt = `Turn the user's rough Google Search Ads request into a specific, factual campaign brief.

Rules:
- Preserve the offer and the user's intent.
- Use saved business context only when it is relevant.
- Never invent prices, claims, proof, discounts, urgency, audiences, or results.
- Put unknown facts in missingQuestions instead of guessing.
- Ask at most 3 questions, only for details that materially affect targeting or ad copy.
- enhancedText must be natural prose ready for campaign planning. Do not include labels such as "Campaign brief", internal instructions, or fallback language.

Return only JSON matching:
{
  "enhancedText": "2-4 concise paragraphs",
  "productOrOffer": "what is being promoted",
  "targetCustomer": "who should respond",
  "painPoints": ["known pain points only"],
  "differentiators": ["known differentiators only"],
  "proofPoints": ["known proof only"],
  "geography": "known target geography or empty string",
  "goal": "campaign goal",
  "tone": "appropriate brand tone",
  "restrictions": ["claims or assumptions to avoid"],
  "missingQuestions": ["up to three concise questions"]
}

User request: ${input.prompt}
Confirmed form inputs: ${JSON.stringify({ budget: input.budget, location: input.location, goal: input.goal })}
Saved business context: ${businessContext || input.brandContext || "None"}
Supported ad platforms: Google Ads and Meta Ads only. Do not ask generic business questions when the saved context answers them.`

  let lastError = ""
  let lastFailure: "provider" | "output" = "output"
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const content = await cachedUtilityCompletion({
        route: "/api/ai/enhance-prompt",
        operation: attempt ? "enhance-prompt-retry" : "enhance-prompt",
        userId,
        workspaceId,
        input: { ...input, attempt },
        json: true,
        messages: [{ role: "user", content: `${prompt}${attempt ? "\nThe previous response was invalid. Return complete JSON only." : ""}` }],
      })
      const brief = parseBrief(content)
      if (brief.success) return NextResponse.json({ ok: true, enhanced: brief.data.enhancedText, brief: brief.data })
      lastFailure = "output"
      lastError = brief.error.issues[0]?.message || "Invalid enhanced brief"
    } catch (error) {
      if (error instanceof CreditQuotaError) {
        return NextResponse.json({ ok: false, error: { code: error.code, message: "Monthly credit quota exceeded. Try again after the workspace credits reset." } }, { status: 402 })
      }
      lastFailure = "provider"
      lastError = "AI provider unavailable"
      log("error", "ai/enhance-prompt", "OpenAI provider request failed", aiErrorMetadata(error))
      lastError = aiUnavailableMessage(error)
    }
  }

  // Conservative fallback: preserve only user-provided facts and surface uncertainty.
  const fallbackBrief = {
    enhancedText: input.prompt,
    productOrOffer: input.prompt.slice(0, 100),
    targetCustomer: "",
    painPoints: [],
    differentiators: [],
    proofPoints: [],
    geography: input.location || "",
    goal: input.goal || "",
    tone: "",
    restrictions: ["AI enhancement was unavailable; verify all claims before launch."],
    missingQuestions: ["Who is the primary customer for this offer?", "What specific differentiator or proof can the campaign use?"],
  }

  return NextResponse.json({ ok: true, enhanced: fallbackBrief.enhancedText, brief: fallbackBrief })
}
