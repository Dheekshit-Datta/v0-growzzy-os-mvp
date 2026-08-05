import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { auth } from "@/lib/auth"
import { resolveUserId } from "@/lib/resolve-user"
import { rateLimitPolicy, rateLimitResponse } from "@/lib/rate-limit"
import { UTILITY_MODEL } from "@/lib/ai-utility"
import { getRequestWorkspaceId } from "@/lib/workspace"
import { assertCreditsAvailable, estimatedCredits, recordCreditUsage, CreditQuotaError } from "@/lib/ai-credits"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" })

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = await resolveUserId(session.user.id)
  const workspaceId = await getRequestWorkspaceId(userId, req)
  const limit = await rateLimitPolicy(userId, "aiUtility")
  if (!limit.allowed) return rateLimitResponse(limit)

  const { theme, goal } = await req.json()
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ ok: false, error: "AI keyword suggestions are unavailable because OPENAI_API_KEY is not configured." }, { status: 503 })
  }
  try {
    await assertCreditsAvailable(workspaceId, estimatedCredits(UTILITY_MODEL))
  } catch (error) {
    if (error instanceof CreditQuotaError) return NextResponse.json({ ok: false, error: "Monthly credit quota exceeded. Try again after the workspace credits reset." }, { status: 402 })
    throw error
  }

  const prompt = `You are a Google Ads keyword strategist. For a campaign about '${theme || "the ad group"}' with goal '${goal || "conversions"}', suggest 15 high-intent keywords. Return ONLY a JSON array: [{ "keyword": string, "matchType": "BROAD"|"PHRASE"|"EXACT", "intent": "high"|"medium", "monthlySearches": "estimated range" }]`
  const completion = await openai.chat.completions.create({
    model: UTILITY_MODEL,
    temperature: 0.35,
    messages: [{ role: "user", content: prompt }],
  })
  try {
    await recordCreditUsage({ workspaceId, userId, route: "/api/ai/suggest-keywords", model: UTILITY_MODEL, inputTokens: completion.usage?.prompt_tokens, outputTokens: completion.usage?.completion_tokens })
  } catch (error) {
    if (error instanceof CreditQuotaError) return NextResponse.json({ ok: false, error: "Monthly credit quota exceeded. Try again after the workspace credits reset." }, { status: 402 })
    throw error
  }
  const raw = completion.choices[0]?.message?.content || "[]"
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim()
  try {
    return NextResponse.json({ ok: true, suggestions: JSON.parse(cleaned) })
  } catch {
    return NextResponse.json({ ok: false, error: "AI did not return usable keyword suggestions. Please try again." }, { status: 502 })
  }
}
