import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { resolveUserId } from "@/lib/resolve-user"
import { rateLimitPolicy, rateLimitResponse } from "@/lib/rate-limit"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" })

const InputSchema = z.object({
  answers: z.object({
    businessName: z.string().max(100).optional(),
    websiteUrl: z.string().max(500).optional(),
    productDescription: z.string().max(1500).optional(),
    idealCustomer: z.string().max(1500).optional(),
    differentiator: z.string().max(1500).optional(),
    marketingHistory: z.string().max(1500).optional(),
    tone: z.string().max(80).optional(),
    primaryGoal: z.string().max(80).optional(),
  }),
  siteData: z.object({
    title: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    brandName: z.string().nullable().optional(),
    headings: z.array(z.string()).max(8).optional(),
    priceHints: z.array(z.string()).max(5).optional(),
  }).nullable().optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  const userId = await resolveUserId(session.user.id)
  const limit = await rateLimitPolicy(userId, "aiUtility")
  if (!limit.allowed) return rateLimitResponse(limit)

  const parsed = InputSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid business answers" }, { status: 400 })
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ ok: false, error: "AI summary is unavailable because OPENAI_API_KEY is not configured." }, { status: 503 })

  const prompt = `Write a factual 3-4 sentence business context summary for future advertising AI. Reconcile the owner's answers with website evidence. Prioritize what is sold, ideal customer and their need, differentiation, marketing history, tone, and goal. Never invent claims, audiences, prices, or results. Return plain text only.\n\nOwner answers:\n${JSON.stringify(parsed.data.answers)}\n\nWebsite evidence:\n${JSON.stringify(parsed.data.siteData || "Not available")}`
  let summary = ""
  for (let attempt = 0; attempt < 2 && !summary; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_CAMPAIGN_BUILDER_MODEL || "gpt-4o",
        temperature: 0.25,
        messages: [{ role: "user", content: prompt }],
      })
      summary = completion.choices[0]?.message?.content?.trim() || ""
    } catch {
      if (attempt === 1) return NextResponse.json({ ok: false, error: "Couldn't summarize your business. Please try again." }, { status: 502 })
    }
  }
  if (!summary) return NextResponse.json({ ok: false, error: "Couldn't summarize your business. Please add a little more detail." }, { status: 502 })
  return NextResponse.json({ ok: true, summary: summary.slice(0, 1000) })
}
