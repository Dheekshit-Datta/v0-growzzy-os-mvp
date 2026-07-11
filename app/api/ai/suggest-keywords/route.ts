import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { auth } from "@/lib/auth"
import { resolveUserId } from "@/lib/resolve-user"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" })

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await resolveUserId(session.user.id)

  const { theme, goal } = await req.json()
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ ok: false, error: "AI keyword suggestions are unavailable because OPENAI_API_KEY is not configured." }, { status: 503 })
  }

  const prompt = `You are a Google Ads keyword strategist. For a campaign about '${theme || "the ad group"}' with goal '${goal || "conversions"}', suggest 15 high-intent keywords. Return ONLY a JSON array: [{ "keyword": string, "matchType": "BROAD"|"PHRASE"|"EXACT", "intent": "high"|"medium", "monthlySearches": "estimated range" }]`
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.35,
    messages: [{ role: "user", content: prompt }],
  })
  const raw = completion.choices[0]?.message?.content || "[]"
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim()
  try {
    return NextResponse.json({ ok: true, suggestions: JSON.parse(cleaned) })
  } catch {
    return NextResponse.json({ ok: false, error: "AI did not return usable keyword suggestions. Please try again." }, { status: 502 })
  }
}
