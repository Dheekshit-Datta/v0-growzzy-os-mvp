import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import OpenAI from "openai"
import { resolveUserId } from "@/lib/resolve-user"
import { rateLimitPolicy, rateLimitResponse } from "@/lib/rate-limit"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
})

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = await resolveUserId(session.user.id)
    const limit = await rateLimitPolicy(userId, "creativeText")
    if (!limit.allowed) return rateLimitResponse(limit)

    const { contentType, tone, prompt } = await req.json()
    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
    }

    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "placeholder") {
      return NextResponse.json(
        { error: "AI content generation is unavailable: OPENAI_API_KEY is not configured." },
        { status: 503 }
      )
    }

    const systemPrompt = getSystemPrompt(contentType, tone)
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2500,
    })

    const content = response.choices[0]?.message?.content || ""
    if (!content) {
      return NextResponse.json({ error: "AI content generation returned an empty response. Please retry." }, { status: 502 })
    }

    return NextResponse.json({ content })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to generate content" }, { status: 500 })
  }
}

function getSystemPrompt(contentType: string, tone: string): string {
  const toneInstruction = `Write in a ${String(tone || "Professional").toLowerCase()} tone throughout.`

  switch (contentType) {
    case "SEO Strategy & Blog":
      return `You are an expert SEO content strategist and blog writer. ${toneInstruction}

Generate a comprehensive, publication-ready blog post that includes:
- An engaging, keyword-rich title (H1)
- A compelling introduction with a hook
- Well-structured sections with H2 and H3 headings
- Actionable insights and real-world examples
- A "Key Takeaways" section
- A strong conclusion with a call to action
- Suggested meta description and target keywords at the end

Format the output in clean Markdown. The blog should be 800-1200 words.`

    case "Video Narrative Script":
      return `You are a professional video script writer specializing in marketing content. ${toneInstruction}

Generate a complete video script that includes:
- HOOK (first 3 seconds to grab attention)
- INTRO (establish topic and value proposition)
- MAIN CONTENT (3-5 key points with talking points and B-roll suggestions)
- CTA (clear call to action)
- Estimated duration and platform recommendations

Format with clear scene labels, speaker directions [in brackets], and visual cues.`

    case "Email Nurture Sequence":
      return `You are an email marketing expert who specializes in conversion-optimized nurture sequences. ${toneInstruction}

Generate a 3-email nurture sequence that includes:
- EMAIL 1: Introduction and Value Hook
- EMAIL 2: Social Proof and Deeper Value
- EMAIL 3: Conversion Push with Urgency

For each email provide:
- Subject line (with A/B variant)
- Preview text
- Full email body with formatting
- CTA button text

Format in clean Markdown with clear email separators.`

    case "Social Content Calendar":
      return `You are a social media strategist who creates high-engagement content calendars. ${toneInstruction}

Generate a 7-day social media content calendar that includes:
- Platform-specific posts (Instagram, Facebook, Twitter/X)
- Post copy with hashtags
- Content type (carousel, single image, reel idea, text post)
- Best posting times
- Engagement hooks and CTAs
- Visual direction notes

Format as a structured calendar in Markdown.`

    default:
      return `You are a professional content writer. ${toneInstruction} Generate high-quality, well-structured content based on the user's topic. Format in Markdown.`
  }
}

