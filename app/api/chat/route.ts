import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { auth } from "@/lib/auth"
import { webSearch, fetchPageText } from "@/lib/deep-research"

export const maxDuration = 120

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" })

/* ─────────────────── Response types ─────────────────── */

export interface SearchResultCitation {
  title: string
  url: string
  snippet: string
  site?: string
}

export interface AgentQuestion {
  id: string
  question: string
  why: string
  options?: { label: string; description: string; recommended?: boolean }[]
}

export interface ExecutionPlanStep {
  stepNumber: number
  title: string
  detail: string
  parallel?: boolean
}

export interface ExecutionPlan {
  title: string
  summary: string
  steps: ExecutionPlanStep[]
}

export interface CreativeOutput {
  headlines: string[]
  descriptions: string[]
  primaryText: string
  cta: string
  imageUrl?: string | null
  imagePrompt?: string
  error?: string
}

export interface CampaignDeliverable {
  name: string
  platform: string
  objective: string
  budgetDaily: number
  currency: string
  schedule: string
  landingPage: string
  targeting: { setting: string; value: string }[]
  keywords: string[]
  headlines: string[]
  descriptions: string[]
  primaryText: string
  cta: string
  kpis: { metric: string; target: string }[]
  imageUrl?: string | null
}

export type AgentResponseBlock =
  | { type: "thinking"; label: string }
  | { type: "text"; content: string }
  | { type: "research"; topic: string; subQueries: string[]; results: SearchResultCitation[]; summary?: string }
  | { type: "questions"; title?: string; count?: number; questions: AgentQuestion[] }
  | { type: "plan"; plan: ExecutionPlan }
  | { type: "creative"; creative: CreativeOutput }
  | { type: "campaign"; campaign: CampaignDeliverable }

/* ─────────────── System prompt builder ─────────────── */

function buildSystemPrompt(brandContext: string, conversationMeta: string): string {
  return `You are Growzzy, the autonomous AI Growth Strategist & Campaign Director inside Growzzy OS.

=== YOUR CONFIRMED BRAND CONTEXT (from My Brand) ===
${brandContext || "No brand profile saved yet. If the user asks to build a campaign, ask for their website URL first to analyse their business."}
=== END BRAND CONTEXT ===

${conversationMeta}

## CORE BEHAVIOR & RULES:
1. **You operate as a real AI brain**: Generate insightful, accurate, and customized responses.
2. **KNOWLEDGE ACCESS**: The user's brand profile (business name, offer, audience segments, competitors, tone, keywords) is provided above. **NEVER ask "What is your business?" or "What do you sell?"**. You already know this!
3. **SUPPORTED PLATFORMS**: Growzzy OS supports **Google Ads** and **Meta Ads** ONLY. NEVER mention or suggest LinkedIn, TikTok, X/Twitter, Snapchat, or Pinterest.
4. **CAMPAIGN CREATION FLOW**:
   - If the user asks to build/launch a campaign, first check if key campaign parameters are missing (Platform choice between Google Ads / Meta Ads, daily budget, or specific geographic focus).
   - If missing, return a "questions" block with 2-3 genuine clarifying questions. Each question should have 2 options (with Google Ads marked recommended for search/intent or Meta Ads for visual/lead gen) AND allow freeform input.
   - If parameters are provided or the user answers, propose a concrete "plan" block (Execution Plan with 4-6 sequential steps).
   - Once the user approves the plan, deliver the "creative" and "campaign" blocks.
5. **RESEARCH FLOW**:
   - When the user asks for competitor analysis, market research, or positioning teardowns, provide a "research" block with real subQueries and live search results, followed by structured Markdown analysis (e.g. "Competitors Overview" and "Positioning Against Competitors").

## RESPONSE FORMAT:
You MUST respond with a JSON object with a "blocks" array:
{
  "blocks": [
    // 1. Text response block
    { "type": "text", "content": "Markdown text with bold headings, bullets, insights..." },

    // 2. Optional Research block (when market/competitor research is requested)
    {
      "type": "research",
      "topic": "Researching Competitors and positioning for [Brand]...",
      "subQueries": [
        "Identify key competitors in AI infrastructure and business automation",
        "Analyze competitor product offerings and unique selling propositions",
        "Understand competitor messaging and target audience",
        "Identify gaps in the market [Brand] can exploit",
        "Best practices for positioning B2B AI infrastructure"
      ],
      "results": [
        { "title": "Example Competitor", "url": "https://example.com", "snippet": "...", "site": "example.com" }
      ]
    },

    // 3. Optional Questions block (when clarifying uncertainty for a new campaign)
    {
      "type": "questions",
      "title": "A few things before I build",
      "count": 3,
      "questions": [
        {
          "id": "platform",
          "question": "Which advertising platform would you like to use?",
          "why": "Different platforms offer different targeting capabilities and ad formats suitable for lead generation.",
          "options": [
            { "label": "Google Ads", "description": "Reach users actively searching for your solutions.", "recommended": true },
            { "label": "Meta Ads", "description": "Target specific business demographics and interests." }
          ]
        },
        {
          "id": "budget",
          "question": "What daily ad spend budget are you planning?",
          "why": "Helps determine keyword bidding strategy and test velocity.",
          "options": [
            { "label": "$50 - $100 / day", "description": "Recommended starting budget for fast signal testing.", "recommended": true },
            { "label": "$100 - $250 / day", "description": "Accelerated volume across multiple ad groups." }
          ]
        },
        {
          "id": "geo",
          "question": "Which geographic regions should we target?",
          "why": "Ensures budget is concentrated on highest converting regions.",
          "options": [
            { "label": "United States & Canada", "description": "High purchasing power and intent.", "recommended": true },
            { "label": "Global (Tier 1 English-speaking)", "description": "US, UK, CA, AU, NZ" }
          ]
        }
      ]
    },

    // 4. Optional Plan block (when ready to propose campaign structure)
    {
      "type": "plan",
      "plan": {
        "title": "Google Ads Lead-Gen Campaign for Operations-Heavy Businesses",
        "summary": "Launch a Google Ads campaign focused on lead generation for [Brand] solutions, targeting high operational complexity businesses.",
        "steps": [
          { "stepNumber": 1, "title": "Keyword Strategy & Ad Group Creation", "detail": "Develop a comprehensive list of high-intent keywords." },
          { "stepNumber": 2, "title": "Compelling Ad Copy Development", "detail": "Craft attention-grabbing headlines and descriptions." },
          { "stepNumber": 3, "title": "Landing Page Optimization Review", "detail": "Align landing page messaging with ad promises." },
          { "stepNumber": 4, "title": "Bidding & Budget Allocation", "detail": "Configure Maximize Conversions bidding." },
          { "stepNumber": 5, "title": "Audience Targeting Refinement", "detail": "Apply in-market and custom intent audiences." },
          { "stepNumber": 6, "title": "Performance Monitoring & Optimization", "detail": "Set up automated weekly negative keyword harvesting." }
        ]
      }
    }
  ]
}

Return ONLY valid JSON matching {"blocks": [...]}. No markdown code fences.`
}

/* ─────────────── Research helper ─────────────── */

async function performResearch(query: string): Promise<SearchResultCitation[]> {
  const results = await webSearch(query, 6)
  const enriched = await Promise.all(
    results.slice(0, 3).map(async (r) => {
      let site = ""
      try {
        site = new URL(r.url).hostname.replace(/^www\./, "")
      } catch {
        site = r.url
      }
      const text = await fetchPageText(r.url, 1500)
      return {
        ...r,
        site,
        snippet: text ? text.slice(0, 250) : r.snippet,
      }
    })
  )

  const rest = results.slice(3).map((r) => {
    let site = ""
    try {
      site = new URL(r.url).hostname.replace(/^www\./, "")
    } catch {
      site = r.url
    }
    return { ...r, site }
  })

  return [...enriched, ...rest]
}

/* ─────────────── Detect if research is needed ─────────────── */

function shouldResearch(messages: { role: string; content: string }[]): string | null {
  const last = messages[messages.length - 1]?.content || ""
  const lower = last.toLowerCase()

  if (/competitor|alternative|compare|market|trend|research|who competes/i.test(lower)) {
    return last.slice(0, 120)
  }
  return null
}

/* ─────────────── Main handler ─────────────── */

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { messages, brandContext, threadTitle } = body as {
      messages: { role: string; content: string }[]
      brandContext: string
      threadTitle?: string
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Messages are required" }, { status: 400 })
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 503 })
    }

    // Check if we should perform live DuckDuckGo web research
    const researchQuery = shouldResearch(messages)
    let liveSearchResults: SearchResultCitation[] = []
    if (researchQuery) {
      liveSearchResults = await performResearch(researchQuery)
    }

    const conversationMeta = threadTitle ? `Current thread title: "${threadTitle}"` : ""
    const systemPrompt = buildSystemPrompt(brandContext || "", conversationMeta)

    const formattedMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
    ]

    for (const m of messages) {
      let content = ""
      if (typeof m.content === "string") {
        content = m.content
      } else if (Array.isArray((m as any).parts)) {
        content = (m as any).parts
          .map((p: any) => p.text || (p.input ? JSON.stringify(p.input) : ""))
          .filter(Boolean)
          .join("\n")
      } else {
        content = JSON.stringify(m.content || "")
      }
      formattedMessages.push({
        role: m.role === "user" ? "user" : "assistant",
        content: content || "...",
      })
    }

    if (liveSearchResults.length > 0) {
      formattedMessages.push({
        role: "system",
        content: `Live Web Research Results:\n${liveSearchResults.map((r, i) => `[${i + 1}] ${r.title} (${r.site || r.url})\n${r.snippet}`).join("\n\n")}`,
      })
    }

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL || "gpt-4o",
      temperature: 0.5,
      response_format: { type: "json_object" },
      messages: formattedMessages,
    })

    const rawContent = completion.choices[0]?.message?.content || "{}"
    let blocks: AgentResponseBlock[] = []

    try {
      const parsed = JSON.parse(rawContent)
      if (Array.isArray(parsed.blocks)) {
        blocks = parsed.blocks
      } else {
        blocks = [{ type: "text", content: rawContent }]
      }
    } catch {
      blocks = [{ type: "text", content: rawContent }]
    }

    // Attach live search results to research blocks
    if (liveSearchResults.length > 0) {
      const rBlockIndex = blocks.findIndex((b) => b.type === "research")
      if (rBlockIndex >= 0) {
        const existing = blocks[rBlockIndex] as any
        blocks[rBlockIndex] = {
          ...existing,
          results: liveSearchResults,
        }
      } else {
        const userQuery = messages[messages.length - 1]?.content || "Market & Competitor Research"
        blocks.unshift({
          type: "research",
          topic: `Researching ${userQuery.slice(0, 60)}...`,
          subQueries: [
            "Identify key competitors and market alternatives",
            "Analyze competitor product positioning and messaging",
            "Identify gaps in the market and differentiation angles",
            "Determine high-converting digital advertising hooks",
          ],
          results: liveSearchResults,
        })
      }
    }

    // Generate auto-thread title
    let generatedTitle = threadTitle
    if (!generatedTitle && messages.length <= 2) {
      const firstUserMsg = messages.find((m) => m.role === "user")?.content || ""
      if (firstUserMsg) {
        generatedTitle = firstUserMsg.length > 55 ? firstUserMsg.slice(0, 52) + "..." : firstUserMsg
      }
    }

    return NextResponse.json({
      ok: true,
      blocks,
      threadTitle: generatedTitle,
      sources: liveSearchResults,
    })
  } catch (error: any) {
    console.error("Agent chat error:", error)
    return NextResponse.json(
      {
        error: error?.message || "Failed to process agent message",
        errorKind: error?.status === 429 ? "rate-limit" : "unknown",
      },
      { status: error?.status === 429 ? 429 : 500 }
    )
  }
}
