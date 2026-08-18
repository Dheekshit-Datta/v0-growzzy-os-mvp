import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { auth } from "@/lib/auth"
import { webSearch, fetchPageText } from "@/lib/deep-research"

export const maxDuration = 60

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" })

const SYSTEM_PROMPT = `You are Growzzy, the autonomous AI Growth Strategist & Campaign Director inside Growzzy OS.

You operate in two core modes:
1. MARKETING ADVISORY & RESEARCH (Default): When the user asks a question, requests growth advice, competitor comparisons, CTR/CPA benchmarks, ad copy feedback, or marketing concepts, answer directly, concisely, and insightfully in Markdown with actionable bullet points and cited sources.
2. AUTONOMOUS CAMPAIGN GENERATION: When the user asks to build, create, or launch a campaign, synthesize their prompt with their Brand Context (Offer, Audience, Competitors, Keywords, Voice). Formulate:
   - Campaign Structure & Objective (Google Display / Search Ads, Meta Ads)
   - High-Intent Keyword Clusters & Negative Keywords
   - Direct-Response Headlines & Descriptions (PAS / AIDA frameworks)
   - Visual Ad Concept & DALL-E 3 Creative Prompt
   - Bidding & Daily Budget Plan

CRITICAL RULES:
- The user's brand context is provided. Never ask basic questions like "What does your company do?" if it is already in the brand context.
- Growzzy supports Google Ads and Meta Ads.
- Be concrete, professional, and direct-response focused.`

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { messages, brandContext } = await req.json()
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Messages are required" }, { status: 400 })
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 503 })
    }

    // Format chat messages for OpenAI
    const systemWithContext = `${SYSTEM_PROMPT}\n\n=== CONFIRMED BRAND CONTEXT ===\n${brandContext || "No brand profile saved yet."}`

    const formattedMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemWithContext },
      ...messages.map((m: any) => ({
        role: m.role === "user" ? ("user" as const) : ("assistant" as const),
        content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
      })),
    ]

    // Check if the latest message asks for research
    const latestUserMsg = messages[messages.length - 1]?.content || ""
    if (typeof latestUserMsg === "string" && /competitor|research|benchmark|compare|search/i.test(latestUserMsg)) {
      const searchResults = await webSearch(latestUserMsg.slice(0, 100), 4)
      if (searchResults.length > 0) {
        formattedMessages.push({
          role: "system",
          content: `Live Web Research Results:\n${searchResults.map((r) => `- ${r.title} (${r.url}): ${r.snippet}`).join("\n")}`,
        })
      }
    }

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL || "gpt-4o",
      temperature: 0.6,
      messages: formattedMessages,
    })

    const reply = completion.choices[0]?.message?.content || "I've analyzed your request."

    return NextResponse.json({
      ok: true,
      message: {
        role: "assistant",
        content: reply,
      },
    })
  } catch (error: any) {
    console.error("Agent chat error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to process agent message" },
      { status: 500 }
    )
  }
}
