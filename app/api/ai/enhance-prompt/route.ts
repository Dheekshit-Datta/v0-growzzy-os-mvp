import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { resolveUserId } from "@/lib/resolve-user"
import { rateLimit } from "@/lib/rate-limit"
import { getRequestWorkspaceId } from "@/lib/workspace"
import { getBusinessContextForWorkspace } from "@/lib/business-context"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" })

const EnhanceSchema = z.object({
  prompt: z.string().min(3).max(2000),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  const userId = await resolveUserId(session.user.id)

  const limit = await rateLimit(`ai:enhance-prompt:${userId}`, 15, 60_000)
  if (!limit.allowed) return NextResponse.json({ ok: false, error: "Too many requests — wait a moment" }, { status: 429 })

  const input = EnhanceSchema.parse(await req.json())
  const workspaceId = await getRequestWorkspaceId(userId, req)
  const businessContext = await getBusinessContextForWorkspace(workspaceId)

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ ok: false, error: "AI Enhance is unavailable because OPENAI_API_KEY is not configured." }, { status: 503 })
  }

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_CAMPAIGN_BUILDER_MODEL || "gpt-4o",
    temperature: 0.5,
    messages: [
      {
        role: "system",
        content:
          "You sharpen rough Google Ads campaign briefs into specific, launch-ready briefs. Given the user's raw description, rewrite and extend it in their voice, adding concrete target audience, budget, and location detail ONLY where it can be reasonably inferred from what they wrote. Never invent facts, numbers, or claims not implied by the input. If key detail is missing, note what's missing instead of guessing. Return plain text, 2-4 short paragraphs, no markdown headers.",
      },
      { role: "user", content: `${input.prompt}${businessContext}` },
    ],
  })

  const enhanced = completion.choices[0]?.message?.content?.trim() || ""
  if (!enhanced) {
    return NextResponse.json({ ok: false, error: "AI did not return an enhanced brief. Please try again." }, { status: 502 })
  }

  return NextResponse.json({ ok: true, enhanced })
}
