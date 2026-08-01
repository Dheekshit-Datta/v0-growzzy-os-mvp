import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { resolveUserId } from "@/lib/resolve-user"
import { rateLimitPolicy, rateLimitResponse } from "@/lib/rate-limit"
import { getRequestWorkspaceId } from "@/lib/workspace"
import { getBusinessContextForWorkspace } from "@/lib/business-context"
import { cachedUtilityCompletion } from "@/lib/ai-utility"

const EnhanceSchema = z.object({
  prompt: z.string().min(3).max(2000),
})

function fallbackEnhancement(prompt: string) {
  return prompt.trim()
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  const userId = await resolveUserId(session.user.id)

  const limit = await rateLimitPolicy(userId, "aiUtility")
  if (!limit.allowed) return rateLimitResponse(limit)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 })
  }
  const parsed = EnhanceSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || "Invalid prompt" }, { status: 400 })
  const input = parsed.data
  const workspaceId = await getRequestWorkspaceId(userId, req)
  const businessContext = await getBusinessContextForWorkspace(workspaceId)

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ ok: true, enhanced: fallbackEnhancement(input.prompt), fallback: true })
  }

  const enhanced = await cachedUtilityCompletion({
      route: "/api/ai/enhance-prompt",
      operation: "enhance-prompt",
      userId,
      workspaceId,
      input: { prompt: input.prompt, businessContext },
      messages: [
        {
          role: "system",
          content:
            "You sharpen rough Google Ads campaign briefs into specific, launch-ready briefs. Given the user's raw description, rewrite and extend it in their voice, adding concrete target audience, budget, and location detail ONLY where it can be reasonably inferred from what they wrote. Never invent facts, numbers, or claims not implied by the input. If key detail is missing, note what's missing instead of guessing. Return plain text, 2-4 short paragraphs, no markdown headers.",
        },
        { role: "user", content: `${input.prompt}${businessContext}` },
      ],
    }).catch(() => "")
  if (!enhanced) {
    return NextResponse.json({ ok: true, enhanced: fallbackEnhancement(input.prompt), fallback: true })
  }

  return NextResponse.json({ ok: true, enhanced })
}
