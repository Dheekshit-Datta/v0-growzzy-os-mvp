import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { auth } from "@/lib/auth"
import { rateLimitPolicy, rateLimitResponse } from "@/lib/rate-limit"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId } from "@/lib/workspace"
import { assertCreditsAvailable, estimatedCredits, recordCreditUsage, CreditQuotaError } from "@/lib/ai-credits"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" })

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = await resolveUserId(session.user.id)
  const workspaceId = await getRequestWorkspaceId(userId, req)
  const limit = await rateLimitPolicy(userId, "creativeText")
  if (!limit.allowed) return rateLimitResponse(limit)
  const body = await req.json()
  const { goal, type, theme, keywords, finalUrl } = body

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ ok: false, error: "AI ad copy generation is unavailable because OPENAI_API_KEY is not configured." }, { status: 503 })
  }
  try {
    await assertCreditsAvailable(workspaceId, estimatedCredits("gpt-4o"))
  } catch (error) {
    if (error instanceof CreditQuotaError) return NextResponse.json({ ok: false, error: "Monthly credit quota exceeded. Try again after the workspace credits reset." }, { status: 402 })
    throw error
  }

  const businessContext = await getBusinessContextForWorkspace(workspaceId)

  const prompt = `You are a world-class Google Ads copywriter. Always personalize ad copy using the workspace brand memory below.
${businessContext}

Campaign goal: ${goal}
Campaign type: ${type}
Ad group theme: ${theme}
Keywords: ${JSON.stringify(keywords || [])}
Landing page URL: ${finalUrl}

Generate:
- 15 unique headlines (MAX 30 characters each)
- 4 descriptions (MAX 90 characters each)

Return ONLY JSON:
{
  "headlines": [{ "text": "...", "angle": "benefit|urgency|cta|feature|question|social_proof" }],
  "descriptions": [{ "text": "..." }]
}`

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.45,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  })
  try {
    await recordCreditUsage({ workspaceId, userId, route: "/api/ai/generate-ad-copy", model: "gpt-4o", inputTokens: completion.usage?.prompt_tokens, outputTokens: completion.usage?.completion_tokens })
  } catch (error) {
    if (error instanceof CreditQuotaError) return NextResponse.json({ ok: false, error: "Monthly credit quota exceeded. Try again after the workspace credits reset." }, { status: 402 })
    throw error
  }
  const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}")
  if (!Array.isArray(parsed.headlines) || !Array.isArray(parsed.descriptions)) {
    return NextResponse.json({ ok: false, error: "AI did not return usable ad copy. Please try again." }, { status: 502 })
  }
  const headlines = parsed.headlines.slice(0, 15).map((h: any) => ({ ...h, text: String(h.text || "").slice(0, 30) }))
  const descriptions = parsed.descriptions.slice(0, 4).map((d: any) => ({ ...d, text: String(d.text || "").slice(0, 90) }))
  return NextResponse.json({ ok: true, headlines, descriptions })
}
