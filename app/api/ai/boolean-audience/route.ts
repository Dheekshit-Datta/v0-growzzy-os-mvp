import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { resolveUserId } from "@/lib/resolve-user"
import { rateLimitPolicy, rateLimitResponse } from "@/lib/rate-limit"
import { getRequestWorkspaceId } from "@/lib/workspace"
import { getBusinessContextForWorkspace } from "@/lib/business-context"
import { cachedUtilityCompletion } from "@/lib/ai-utility"

const BooleanAudienceSchema = z.object({
  query: z.string().min(3).max(500),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  const userId = await resolveUserId(session.user.id)

  const limit = await rateLimitPolicy(userId, "aiUtility")
  if (!limit.allowed) return rateLimitResponse(limit)

  const input = BooleanAudienceSchema.parse(await req.json())
  const workspaceId = await getRequestWorkspaceId(userId, req)
  const businessContext = await getBusinessContextForWorkspace(workspaceId)

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ ok: false, error: "Boolean audience search is unavailable because OPENAI_API_KEY is not configured." }, { status: 503 })
  }

  const content = await cachedUtilityCompletion({
    route: "/api/ai/boolean-audience",
    operation: "boolean-audience",
    userId,
    workspaceId,
    input: { query: input.query, businessContext },
    json: true,
    messages: [
      {
        role: "system",
        content: `Google Ads has no native "boolean audience query" concept — it targets via search keywords, not boolean people-search like LinkedIn Recruiter. Translate the user's boolean-style audience description (using AND/OR/NOT, age:, location: operators) into a real, launch-ready Google Search Ads keyword set that would actually reach that audience.
Rules:
- Only propose keywords a real searcher in that audience would plausibly type
- Assign each keyword a matchType of BROAD, PHRASE, or EXACT
- Propose negative keywords to exclude clearly irrelevant traffic implied by NOT clauses or by the audience description
- Explain in one sentence how each operator in the query was interpreted
- Never fabricate demographic reach numbers or platform capabilities Google Ads doesn't have
Return ONLY JSON: {"interpretation": "one paragraph explaining how the boolean query maps to Google Search intent", "keywords": [{"text": "...", "matchType": "BROAD|PHRASE|EXACT", "rationale": "..."}], "negativeKeywords": ["..."]}`,
      },
      { role: "user", content: `${input.query}${businessContext}` },
    ],
  })

  const parsed = JSON.parse(content || "{}")
  const keywords = Array.isArray(parsed.keywords)
    ? parsed.keywords.slice(0, 30).map((k: any) => ({
        text: String(k?.text || "").slice(0, 80),
        matchType: ["BROAD", "PHRASE", "EXACT"].includes(String(k?.matchType)) ? String(k.matchType) : "PHRASE",
        rationale: String(k?.rationale || "").slice(0, 200),
      })).filter((k: any) => k.text)
    : []

  if (!keywords.length) {
    return NextResponse.json({ ok: false, error: "AI could not translate this query into keywords. Try rephrasing." }, { status: 502 })
  }

  return NextResponse.json({
    ok: true,
    interpretation: String(parsed.interpretation || "").slice(0, 600),
    keywords,
    negativeKeywords: (Array.isArray(parsed.negativeKeywords) ? parsed.negativeKeywords : []).slice(0, 20).map((k: any) => String(k || "").slice(0, 80)).filter(Boolean),
  })
}
